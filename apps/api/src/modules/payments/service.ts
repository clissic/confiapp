import {
  NotificationChannel,
  NotificationType,
  ParticipantRole,
  ParticipantStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  TransactionInitiator,
  TransactionStatus,
  WalletMovementDirection,
  WalletMovementType,
  WalletStatus,
  type IPayment,
  type ITransaction,
} from '@confiapp/database';
import { Types, type HydratedDocument } from 'mongoose';

import { PaymentEventLogModel } from '../../database/models/payment-event-log.model';
import { PaymentModel, TransactionModel, UserModel } from '../../database/models';
import { mercadoPagoClient } from '../../infrastructure/payments/mercadopago.client';
import { env } from '../../shared/config/env';
import {
  assertAppCurrency,
  defaultCurrency,
  exampleGrossCents,
} from '../../shared/config/currency';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';
import { assertTransition } from '../transactions/state-machine';
import { assertNotPastDeadline } from '../transactions/operation-deadline';
import { walletLedger } from '../wallet/service';
import { AuditAction, AuditOutcome, auditService } from '../audit';
import { notificationsService } from '../notifications/service';
import {
  computeEscrowSplit,
  IntermediationFeeError,
  type EscrowSplit,
  type FeePayer,
} from './split';

export type PaymentDocument = HydratedDocument<IPayment>;
type TransactionDocument = HydratedDocument<ITransaction>;

function feesAuditMeta(split: EscrowSplit) {
  return {
    feePayer: split.feePayer,
    productCents: split.productCents,
    commissionCents: split.commissionCents,
    commissionUsd: split.commissionUsd,
    buyerPaysCents: split.buyerPaysCents,
    sellerNetCents: split.sellerNetCents,
    platformFeeCents: split.platformFeeCents,
    agentFeeCents: split.agentFeeCents,
    currency: split.currency,
  };
}
function partyRoles(initiatedBy: TransactionInitiator): {
  buyerRole: 'creator' | 'counterparty';
  sellerRole: 'creator' | 'counterparty';
} {
  if (initiatedBy === TransactionInitiator.SELLER) {
    return { buyerRole: 'counterparty', sellerRole: 'creator' };
  }
  return { buyerRole: 'creator', sellerRole: 'counterparty' };
}

function resolveParties(tx: TransactionDocument): {
  buyerId: string;
  sellerId: string;
  agentId?: string;
} {
  const roles = partyRoles(tx.initiatedBy ?? TransactionInitiator.BUYER);
  const counter = tx.participants.find((p) => p.role === ParticipantRole.COUNTERPARTY);
  const agent = tx.participants.find(
    (p) =>
      p.role === ParticipantRole.INTERMEDIARY && p.status === ParticipantStatus.ACCEPTED,
  );
  const creatorId = String(tx.createdBy);
  const counterId = counter ? String(counter.user) : undefined;
  const buyerId = roles.buyerRole === 'creator' ? creatorId : counterId;
  const sellerId = roles.sellerRole === 'creator' ? creatorId : counterId;
  if (!buyerId || !sellerId) {
    throw new ValidationError('La operación aún no tiene comprador y vendedor definidos');
  }
  return {
    buyerId,
    sellerId,
    agentId: agent ? String(agent.user) : undefined,
  };
}

async function persistLog(input: {
  source: 'checkout' | 'webhook' | 'confirm' | 'release' | 'system';
  event: string;
  message: string;
  level?: 'info' | 'warn' | 'error';
  transactionId?: string;
  paymentId?: string;
  externalId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const level = input.level ?? 'info';
  logger[level](input.message, {
    domain: 'payments',
    event: input.event,
    transactionId: input.transactionId,
    paymentId: input.paymentId,
    externalId: input.externalId,
    payload: input.payload,
  });
  try {
    await PaymentEventLogModel.create({
      source: input.source,
      event: input.event,
      message: input.message,
      level,
      transactionId: input.transactionId,
      paymentId: input.paymentId,
      externalId: input.externalId,
      payload: input.payload,
    });
  } catch (error) {
    logger.error('payment event log persist failed', { error });
  }
}

function toPaymentDto(p: {
  _id: Types.ObjectId;
  transaction: Types.ObjectId;
  payer: Types.ObjectId;
  payee?: Types.ObjectId;
  type: string;
  status: string;
  provider: string;
  amountCents: number;
  currency: string;
  externalId?: string;
  idempotencyKey: string;
  authorizedAt?: Date;
  capturedAt?: Date;
  releasedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}) {
  return {
    id: String(p._id),
    transactionId: String(p.transaction),
    payerId: String(p.payer),
    payeeId: p.payee ? String(p.payee) : undefined,
    type: p.type,
    status: p.status,
    provider: p.provider,
    amountCents: p.amountCents,
    currency: p.currency,
    externalId: p.externalId,
    idempotencyKey: p.idempotencyKey,
    authorizedAt: p.authorizedAt?.toISOString(),
    capturedAt: p.capturedAt?.toISOString(),
    releasedAt: p.releasedAt?.toISOString(),
    metadata: p.metadata,
    createdAt: p.createdAt.toISOString(),
  };
}

export class PaymentsService {
  splitForTransaction(tx: {
    amountCents?: number;
    currency?: string;
    feePayer?: FeePayer | string | null;
  }): EscrowSplit {
    const currency = assertAppCurrency(tx.currency ?? defaultCurrency());
    const productCents =
      tx.amountCents && tx.amountCents > 0 ? tx.amountCents : exampleGrossCents(currency);
    const feePayer = (tx.feePayer ?? 'BUYER') as FeePayer;
    try {
      return computeEscrowSplit({
        productCents,
        currency,
        feePayer,
        uyuPerUsd: env.USD_UYU_RATE,
        platformCommissionBps: env.PAYMENTS_PLATFORM_FEE_BPS,
        agentCommissionBps: env.PAYMENTS_AGENT_FEE_BPS,
      });
    } catch (error) {
      if (error instanceof IntermediationFeeError) {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  }

  /** @deprecated Preferir splitForTransaction */
  splitForAmount(grossCents: number, currency = defaultCurrency(), feePayer: FeePayer = 'BUYER'): EscrowSplit {
    return this.splitForTransaction({ amountCents: grossCents, currency, feePayer });
  }

  async getTransactionEscrow(userId: string, code: string) {
    const tx = await this.loadTxForParticipant(userId, code);
    const parties = resolveParties(tx);
    const currency = assertAppCurrency(tx.currency ?? defaultCurrency());
    const split = this.splitForTransaction(tx);
    const payments = await PaymentModel.find({
      transaction: tx._id,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      transactionId: String(tx._id),
      code: tx.code,
      status: tx.status,
      currency,
      country: env.MERCADOPAGO_COUNTRY,
      siteId: env.MERCADOPAGO_SITE_ID,
      grossCents: split.buyerPaysCents,
      productCents: split.productCents,
      commissionCents: split.commissionCents,
      feePayer: split.feePayer,
      split,
      parties,
      providerMode: mercadoPagoClient.isMock() ? 'MOCK' : 'MERCADOPAGO',
      payments: payments.map((p) => toPaymentDto(p)),
    };
  }

  async listMine(userId: string) {
    const payments = await PaymentModel.find({
      $or: [{ payer: userId }, { payee: userId }],
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean()
      .exec();
    return { items: payments.map((p) => toPaymentDto(p)) };
  }

  /** Pago del comprador → Preference MP + ESCROW_HOLD pendiente (retención). */
  async createBuyerCheckout(userId: string, code: string) {
    const tx = await this.loadTxForParticipant(userId, code);
    const parties = resolveParties(tx);

    if (parties.buyerId !== userId) {
      throw new ForbiddenError('Solo el comprador puede iniciar el pago');
    }
    if (
      tx.status !== TransactionStatus.ACCEPTED &&
      tx.status !== TransactionStatus.FUNDED
    ) {
      throw new ValidationError(
        `La operación debe estar ACCEPTED para pagar (actual: ${tx.status})`,
      );
    }
    if (tx.status === TransactionStatus.FUNDED) {
      throw new ValidationError('La operación ya tiene el pago protegido');
    }
    assertNotPastDeadline(tx);

    const existingHold = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      status: {
        $in: [
          PaymentStatus.PENDING,
          PaymentStatus.REQUIRES_ACTION,
          PaymentStatus.AUTHORIZED,
          PaymentStatus.CAPTURED,
        ],
      },
      deletedAt: null,
    }).exec();

    if (existingHold?.status === PaymentStatus.CAPTURED) {
      throw new ValidationError('Ya existe un pago protegido capturado para esta operación');
    }

    const currency = assertAppCurrency(tx.currency ?? defaultCurrency());
    const split = this.splitForTransaction(tx);
    const productCents = split.productCents;
    const buyerPays = split.buyerPaysCents;
    if (!tx.amountCents || tx.amountCents <= 0) {
      tx.amountCents = productCents;
      tx.currency = currency;
      await tx.save();
    } else if (!tx.currency) {
      tx.currency = currency;
      await tx.save();
    }
    if (!tx.feePayer) {
      tx.feePayer = split.feePayer as ITransaction['feePayer'];
      await tx.save();
    }

    const idempotencyKey = `hold:${String(tx._id)}`;

    let hold =
      existingHold ??
      (await PaymentModel.create({
        transaction: tx._id,
        payer: new Types.ObjectId(parties.buyerId),
        payee: new Types.ObjectId(parties.sellerId),
        type: PaymentType.ESCROW_HOLD,
        status: PaymentStatus.PENDING,
        provider: mercadoPagoClient.isMock()
          ? PaymentProvider.MOCK
          : PaymentProvider.MERCADOPAGO,
        amountCents: buyerPays,
        currency,
        idempotencyKey,
        metadata: {
          split,
          phase: 'retention',
          country: env.MERCADOPAGO_COUNTRY,
          siteId: env.MERCADOPAGO_SITE_ID,
        },
      }));

    if (existingHold && hold.amountCents !== buyerPays) {
      hold.amountCents = buyerPays;
    }

    const externalReference = String(hold._id);
    const notificationUrl = `${env.API_PUBLIC_URL}/payments/webhooks/mercadopago`;
    const backBase = `${env.APP_URL}/operaciones/${encodeURIComponent(tx.code)}`;

    const preference = await mercadoPagoClient.createPreference({
      items: [
        {
          title: `Pago protegido ConfiApp ${tx.code} — ${tx.title}`.slice(0, 250),
          quantity: 1,
          unitPriceCents: buyerPays,
          currency,
        },
      ],
      externalReference,
      notificationUrl,
      backUrls: {
        success: `${backBase}?pago=ok`,
        failure: `${backBase}?pago=failure`,
        pending: `${backBase}?pago=pending`,
      },
      mockBridgeUrl: `${env.APP_URL}/operaciones/${encodeURIComponent(tx.code)}/pagar/simular?paymentId=${encodeURIComponent(externalReference)}`,
    });

    hold.externalId = preference.id;
    hold.status = PaymentStatus.REQUIRES_ACTION;
    hold.provider =
      preference.provider === 'MOCK' ? PaymentProvider.MOCK : PaymentProvider.MERCADOPAGO;
    hold.metadata = {
      ...(hold.metadata ?? {}),
      split,
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      phase: 'retention',
      transactionCode: tx.code,
    };
    await hold.save();

    await persistLog({
      source: 'checkout',
      event: 'checkout.created',
      message: 'Checkout comprador creado (pago protegido)',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      externalId: preference.id,
      payload: { code: tx.code, split, provider: hold.provider },
    });

    auditService.track({
      actor: userId,
      action: existingHold ? AuditAction.PAYMENT_UPDATED : AuditAction.PAYMENT_CREATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'checkout_created',
        code: tx.code,
        amountCents: buyerPays,
        provider: hold.provider,
        preferenceId: preference.id,
        reusedExisting: Boolean(existingHold),
        ...feesAuditMeta(split),
      },
    });

    return {
      payment: toPaymentDto(hold.toObject()),
      checkoutUrl: preference.sandboxInitPoint || preference.initPoint,
      preferenceId: preference.id,
      split,
      providerMode: preference.provider,
    };
  }

  /** Confirmación MOCK (dev) o llamada interna post-webhook aprobado. */
  async confirmHold(paymentId: string, opts: { externalPaymentId?: string; source: 'webhook' | 'confirm' }) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new NotFoundError('Pago no encontrado');
    }
    const hold = await PaymentModel.findOne({
      _id: paymentId,
      type: PaymentType.ESCROW_HOLD,
      deletedAt: null,
    }).exec();
    if (!hold) throw new NotFoundError('Hold no encontrado');

    if (
      hold.status === PaymentStatus.CAPTURED ||
      hold.status === PaymentStatus.RELEASED
    ) {
      return { payment: toPaymentDto(hold.toObject()), alreadyConfirmed: true };
    }

    const tx = await TransactionModel.findById(hold.transaction).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const now = new Date();
    hold.status = PaymentStatus.CAPTURED;
    hold.authorizedAt = hold.authorizedAt ?? now;
    hold.capturedAt = now;
    if (opts.externalPaymentId) {
      hold.metadata = {
        ...(hold.metadata ?? {}),
        mpPaymentId: opts.externalPaymentId,
        phase: 'retained',
      };
      hold.externalId = hold.externalId || opts.externalPaymentId;
    } else {
      hold.metadata = { ...(hold.metadata ?? {}), phase: 'retained' };
    }
    await hold.save();

    // Retención en wallet del vendedor (held), no disponible.
    const parties = resolveParties(tx);
    await UserModel.updateOne(
      { _id: parties.sellerId, 'wallet.status': { $ne: WalletStatus.CLOSED } },
      {
        $inc: { 'wallet.heldCents': hold.amountCents },
        $set: { 'wallet.lastMovementAt': now },
      },
    ).exec();

    const sellerAfter = await UserModel.findById(parties.sellerId).select('wallet').lean();
    await walletLedger.record({
      userId: parties.sellerId,
      type: WalletMovementType.ESCROW_HOLD,
      direction: WalletMovementDirection.CREDIT,
      amountCents: hold.amountCents,
      currency: hold.currency,
      description: `Retención escrow ${tx.code}`,
      paymentId: String(hold._id),
      transactionId: String(tx._id),
      balanceAfter: sellerAfter
        ? {
            availableCents: sellerAfter.wallet?.availableCents ?? 0,
            pendingCents: sellerAfter.wallet?.pendingCents ?? 0,
            heldCents: sellerAfter.wallet?.heldCents ?? 0,
          }
        : undefined,
    });

    let justFunded = false;
    if (tx.status === TransactionStatus.ACCEPTED) {
      assertTransition(tx.status, TransactionStatus.FUNDED);
      tx.status = TransactionStatus.FUNDED;
      tx.fundedAt = now;
      tx.statusHistory.push({
        status: TransactionStatus.FUNDED,
        changedAt: now,
        changedBy: hold.payer,
        note: 'Pago protegido confirmado con Mercado Pago',
      });
      await tx.save();
      justFunded = true;
    }

    await persistLog({
      source: opts.source,
      event: 'hold.captured',
      message: 'Pago comprador confirmado — fondos en retención',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      externalId: opts.externalPaymentId ?? hold.externalId,
      payload: { status: hold.status, amountCents: hold.amountCents },
    });

    const feeSnap = this.splitForTransaction(tx);
    auditService.track({
      actor: String(hold.payer),
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'hold_captured',
        code: tx.code,
        amountCents: hold.amountCents,
        transactionId: String(tx._id),
        status: hold.status,
        ...feesAuditMeta(feeSnap),
      },
    });
    if (justFunded) {
      auditService.track({
        actor: String(hold.payer),
        action: AuditAction.STATUS_CHANGE,
        entityType: 'Transaction',
        entityId: String(tx._id),
        outcome: AuditOutcome.SUCCESS,
        correlationId: tx.code,
        metadata: {
          code: tx.code,
          step: 'escrow_funded',
          to: TransactionStatus.FUNDED,
          note: 'pago_protegido',
          ...feesAuditMeta(feeSnap),
        },
      });

      const href = `/operaciones/${tx.code}`;
      const notifyIds = [parties.buyerId, parties.sellerId].filter(
        (id, idx, arr) => Boolean(id) && arr.indexOf(id) === idx,
      );
      await Promise.all(
        notifyIds.map((uid) =>
          notificationsService.notify({
            userId: uid,
            type: NotificationType.PAYMENT,
            title: 'Pago protegido confirmado',
            body:
              uid === parties.buyerId
                ? `Tu pago de ${tx.code} quedó en resguardo hasta confirmar la entrega.`
                : `El comprador pagó ${tx.code}. El monto está en resguardo hasta confirmar la entrega.`,
            data: { href, code: tx.code, status: TransactionStatus.FUNDED },
            entityType: 'Transaction',
            entityId: String(tx._id),
            channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          }),
        ),
      );
    }

    return { payment: toPaymentDto(hold.toObject()), alreadyConfirmed: false };
  }

  async confirmMockCheckout(paymentId: string) {
    if (!mercadoPagoClient.isMock()) {
      throw new ValidationError('Confirmación mock solo disponible sin MERCADOPAGO_ACCESS_TOKEN');
    }
    const result = await this.confirmHold(paymentId, {
      source: 'confirm',
      externalPaymentId: `MOCK-PAY-${paymentId}`,
    });
    const hold = await PaymentModel.findById(paymentId).lean().exec();
    const tx = hold
      ? await TransactionModel.findById(hold.transaction).select('code').lean().exec()
      : null;
    return {
      ...result,
      transactionCode: tx?.code,
    };
  }

  /** Webhook Mercado Pago: confirma retención cuando payment=approved. */
  async handleMercadoPagoWebhook(input: {
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    headers: { xSignature?: string; xRequestId?: string };
  }) {
    const dataId =
      String(
        (input.query['data.id'] as string | undefined) ||
          (input.body?.data as { id?: string } | undefined)?.id ||
          input.query.id ||
          '',
      ) || undefined;

    const topic = String(
      input.query.type ||
        input.query.topic ||
        input.body?.type ||
        input.body?.action ||
        'unknown',
    );

    await persistLog({
      source: 'webhook',
      event: 'webhook.received',
      message: 'Webhook Mercado Pago recibido',
      externalId: dataId,
      payload: { topic, query: input.query, body: input.body },
    });

    const signatureOk = mercadoPagoClient.verifyWebhookSignature({
      xSignature: input.headers.xSignature,
      xRequestId: input.headers.xRequestId,
      dataId,
    });
    if (!signatureOk) {
      await persistLog({
        source: 'webhook',
        event: 'webhook.signature_invalid',
        level: 'warn',
        message: 'Firma de webhook inválida',
        externalId: dataId,
      });
      throw new ForbiddenError('Webhook signature inválida');
    }

    if (!dataId) {
      return { handled: false, reason: 'missing_data_id' };
    }

    const isPaymentTopic =
      topic.includes('payment') || input.body?.action === 'payment.updated';
    if (!isPaymentTopic && topic !== 'unknown') {
      return { handled: false, reason: 'ignored_topic', topic };
    }

    const mpPayment = await mercadoPagoClient.getPayment(dataId);
    const externalRef = mpPayment.externalReference;
    if (!externalRef || !Types.ObjectId.isValid(externalRef)) {
      await persistLog({
        source: 'webhook',
        event: 'webhook.unmapped',
        level: 'warn',
        message: 'Payment MP sin external_reference de hold',
        externalId: dataId,
        payload: { mpPayment },
      });
      return { handled: false, reason: 'unmapped_reference' };
    }

    if (mpPayment.status === 'approved') {
      const result = await this.confirmHold(externalRef, {
        source: 'webhook',
        externalPaymentId: mpPayment.id,
      });
      return { handled: true, confirmed: true, payment: result.payment };
    }

    if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
      await PaymentModel.updateOne(
        { _id: externalRef, type: PaymentType.ESCROW_HOLD },
        {
          $set: {
            status:
              mpPayment.status === 'cancelled'
                ? PaymentStatus.CANCELLED
                : PaymentStatus.FAILED,
            failureReason: mpPayment.statusDetail ?? mpPayment.status,
          },
        },
      ).exec();
      await persistLog({
        source: 'webhook',
        event: 'hold.failed',
        level: 'warn',
        message: `Pago MP ${mpPayment.status}`,
        paymentId: externalRef,
        externalId: dataId,
        payload: { statusDetail: mpPayment.statusDetail },
      });
      return { handled: true, confirmed: false, status: mpPayment.status };
    }

    return { handled: true, confirmed: false, status: mpPayment.status };
  }

  /**
   * Liberación: descuenta 20% plataforma, paga agente, libera neto al vendedor.
   */
  async releaseEscrow(userId: string, code: string) {
    const tx = await this.loadTxForParticipant(userId, code);
    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        `Solo se puede liberar con pago protegido o en curso (actual: ${tx.status})`,
      );
    }
    assertNotPastDeadline(tx);

    const parties = resolveParties(tx);
    const hold = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      status: PaymentStatus.CAPTURED,
      deletedAt: null,
    }).exec();
    if (!hold) throw new ValidationError('No hay fondos retenidos para liberar');

    const alreadyReleased = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_RELEASE,
      status: { $in: [PaymentStatus.RELEASED, PaymentStatus.CAPTURED] },
      deletedAt: null,
    }).lean();
    if (alreadyReleased) {
      throw new ValidationError('El pago protegido ya fue liberado');
    }

    const split = this.splitForTransaction(tx);
    const heldCents = hold.amountCents;
    const currency = hold.currency;
    const now = new Date();
    const provider = hold.provider;
    const sellerNet = Math.max(0, split.sellerNetCents);
    const platformFee = Math.max(0, split.platformFeeCents);
    const agentFee = Math.max(0, split.agentFeeCents);

    const release = await PaymentModel.create({
      transaction: tx._id,
      payer: hold.payer,
      payee: new Types.ObjectId(parties.sellerId),
      type: PaymentType.ESCROW_RELEASE,
      status: PaymentStatus.RELEASED,
      provider,
      amountCents: Math.max(1, sellerNet || 1),
      currency,
      idempotencyKey: `release:${String(tx._id)}`,
      releasedAt: now,
      capturedAt: now,
      metadata: { split, fromHoldId: String(hold._id) },
    });

    const fee = await PaymentModel.create({
      transaction: tx._id,
      payer: hold.payer,
      type: PaymentType.PLATFORM_FEE,
      status: PaymentStatus.CAPTURED,
      provider,
      amountCents: Math.max(1, platformFee || 1),
      currency,
      idempotencyKey: `fee:${String(tx._id)}`,
      capturedAt: now,
      metadata: { split, bps: env.PAYMENTS_PLATFORM_FEE_BPS },
    });

    let agentPayment = null as PaymentDocument | null;
    if (parties.agentId && agentFee > 0) {
      agentPayment = await PaymentModel.create({
        transaction: tx._id,
        payer: hold.payer,
        payee: new Types.ObjectId(parties.agentId),
        type: PaymentType.AGENT_PAYOUT,
        status: PaymentStatus.RELEASED,
        provider,
        amountCents: agentFee,
        currency,
        idempotencyKey: `agent:${String(tx._id)}`,
        releasedAt: now,
        capturedAt: now,
        metadata: { split, bps: env.PAYMENTS_AGENT_FEE_BPS },
      });

      await UserModel.updateOne(
        { _id: parties.agentId },
        {
          $inc: {
            'wallet.availableCents': agentFee,
            'wallet.lifetimeEarnedCents': agentFee,
          },
          $set: { 'wallet.lastMovementAt': now },
        },
      ).exec();

      const agentAfter = await UserModel.findById(parties.agentId).select('wallet').lean();
      await walletLedger.record({
        userId: parties.agentId,
        type: WalletMovementType.AGENT_PAYOUT,
        direction: WalletMovementDirection.CREDIT,
        amountCents: agentFee,
        currency,
        description: `Pago agente · ${tx.code}`,
        paymentId: String(agentPayment._id),
        transactionId: String(tx._id),
        balanceAfter: agentAfter
          ? {
              availableCents: agentAfter.wallet?.availableCents ?? 0,
              pendingCents: agentAfter.wallet?.pendingCents ?? 0,
              heldCents: agentAfter.wallet?.heldCents ?? 0,
            }
          : undefined,
      });
    }

    // Vendedor: sale de held lo pagado por el comprador, entra available el neto.
    await UserModel.updateOne(
      { _id: parties.sellerId },
      {
        $inc: {
          'wallet.heldCents': -heldCents,
          'wallet.availableCents': sellerNet,
          'wallet.lifetimeEarnedCents': sellerNet,
        },
        $set: { 'wallet.lastMovementAt': now },
      },
    ).exec();

    const sellerAfter = await UserModel.findById(parties.sellerId).select('wallet').lean();
    await walletLedger.record({
      userId: parties.sellerId,
      type: WalletMovementType.ESCROW_RELEASE,
      direction: WalletMovementDirection.CREDIT,
      amountCents: sellerNet,
      currency,
      description: `Liberación neto · ${tx.code}`,
      paymentId: String(release._id),
      transactionId: String(tx._id),
      balanceAfter: sellerAfter
        ? {
            availableCents: sellerAfter.wallet?.availableCents ?? 0,
            pendingCents: sellerAfter.wallet?.pendingCents ?? 0,
            heldCents: sellerAfter.wallet?.heldCents ?? 0,
          }
        : undefined,
      metadata: {
        heldCents,
        ...feesAuditMeta(split),
      },
    });

    await walletLedger.record({
      userId: parties.sellerId,
      type: WalletMovementType.PLATFORM_FEE,
      direction: WalletMovementDirection.DEBIT,
      amountCents: Math.max(1, platformFee || 1),
      currency,
      description: `Comisión ConfiApp (20% de la intermediación) · ${tx.code}`,
      paymentId: String(fee._id),
      transactionId: String(tx._id),
      metadata: { informational: true, ...feesAuditMeta(split) },
    });

    hold.status = PaymentStatus.RELEASED;
    hold.releasedAt = now;
    hold.metadata = { ...(hold.metadata ?? {}), phase: 'released', split };
    await hold.save();

    assertTransition(tx.status, TransactionStatus.COMPLETED);
    tx.status = TransactionStatus.COMPLETED;
    tx.completedAt = now;
    tx.statusHistory.push({
      status: TransactionStatus.COMPLETED,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: 'Fondos liberados al vendedor',
    });
    await tx.save();

    await persistLog({
      source: 'release',
      event: 'escrow.released',
      message: 'Pago protegido liberado (neto vendedor + comisión)',
      transactionId: String(tx._id),
      paymentId: String(release._id),
      payload: {
        split,
        feePaymentId: String(fee._id),
        agentPaymentId: agentPayment ? String(agentPayment._id) : null,
        releasedBy: userId,
      },
    });

    auditService.track({
      actor: userId,
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'Payment',
      entityId: String(release._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'escrow_released',
        code: tx.code,
        platformFeeId: String(fee._id),
        agentPaymentId: agentPayment ? String(agentPayment._id) : null,
        ...feesAuditMeta(split),
      },
    });
    auditService.track({
      actor: userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'escrow_released',
        to: TransactionStatus.COMPLETED,
        note: 'escrow_released',
        ...feesAuditMeta(split),
      },
    });

    try {
      const { reputationService } = await import('../reviews/service');
      await reputationService.onTransactionCompleted(tx);
    } catch (error) {
      logger.error('reputation onTransactionCompleted failed', { error, code: tx.code });
    }

    const href = `/operaciones/${tx.code}`;
    const releaseNotifyIds = [
      parties.buyerId,
      parties.sellerId,
      parties.agentId,
    ].filter((id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx);

    await Promise.all(
      releaseNotifyIds.map((uid) =>
        notificationsService.notify({
          userId: uid,
          type: NotificationType.PAYMENT,
          title: 'Operación completada',
          body:
            uid === parties.sellerId
              ? `Se liberaron los fondos de ${tx.code}. Ya podés verlos en tu wallet.`
              : uid === parties.agentId
                ? `Se acreditó tu pago de intermediación en ${tx.code}.`
                : `La operación ${tx.code} se completó y los fondos fueron liberados al vendedor.`,
          data: { href, code: tx.code, status: TransactionStatus.COMPLETED },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );

    return {
      transactionStatus: tx.status,
      split,
      release: toPaymentDto(release.toObject()),
      platformFee: toPaymentDto(fee.toObject()),
      agentPayout: agentPayment ? toPaymentDto(agentPayment.toObject()) : null,
    };
  }

  async listEventLogs(limit = 50) {
    const items = await PaymentEventLogModel.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200))
      .lean()
      .exec();
    return {
      items: items.map((row) => ({
        id: String(row._id),
        source: row.source,
        event: row.event,
        level: row.level,
        message: row.message,
        transactionId: row.transactionId,
        paymentId: row.paymentId,
        externalId: row.externalId,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async loadTxForParticipant(userId: string, code: string) {
    const tx = await TransactionModel.findOne({
      code: code.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');
    const isParticipant =
      String(tx.createdBy) === userId ||
      tx.participants.some((p) => String(p.user) === userId);
    if (!isParticipant) throw new ForbiddenError('No tenés acceso a esta operación');
    return tx;
  }
}
