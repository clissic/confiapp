import {
  NotificationChannel,
  NotificationType,
  ParticipantRole,
  ParticipantStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  PlatformRole,
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
import { paymentProvider } from '../../infrastructure/payments/mercadopago.payment-provider';
import { agentCommissionService } from '../finance/commission.service';
import { financialAudit } from '../finance/financial-audit.service';
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
import { sendManualPrexReceiptEmail } from './manual-prex-email';
import { isManualPrexAdminConfirmed } from './manual-prex-gate';
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
    commissionUyu: split.commissionUyu,
    commissionUsd: split.commissionUyu,
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

/** Monto que debe transferir el comprador ahora (comisión + tip ConfiAnza si aplica). */
function buyerAmountDueCents(
  tx: {
    amountCents?: number;
    currency?: string;
    feePayer?: FeePayer | string | null;
    initiatedBy?: TransactionInitiator | string;
    confiAnzaCents?: number;
    confiAnzaCurrency?: string;
  },
  split: EscrowSplit,
): number {
  let cents = split.buyerPaysCents;
  const tip = tx.confiAnzaCents && tx.confiAnzaCents > 0 ? tx.confiAnzaCents : 0;
  if (tip <= 0) return cents;
  const tipCurrency = (tx.confiAnzaCurrency || tx.currency || split.currency).toUpperCase();
  const opCurrency = (tx.currency || split.currency).toUpperCase();
  const creatorIsBuyer =
    (tx.initiatedBy ?? TransactionInitiator.BUYER) === TransactionInitiator.BUYER;
  if (creatorIsBuyer && tipCurrency === opCurrency) {
    cents += tip;
  }
  return cents;
}

function prexAccountDto() {
  return {
    bank: 'Prex',
    accountName: env.PAYMENTS_PREX_ACCOUNT_NAME,
    accountNumber: env.PAYMENTS_PREX_ACCOUNT_NUMBER,
  };
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
      amountDueCents: buyerAmountDueCents(tx, split),
      productCents: split.productCents,
      commissionCents: split.commissionCents,
      feePayer: split.feePayer,
      split,
      parties,
      checkoutMode: env.PAYMENTS_CHECKOUT_MODE,
      prexAccount: env.PAYMENTS_CHECKOUT_MODE === 'manual_prex' ? prexAccountDto() : undefined,
      providerMode:
        env.PAYMENTS_CHECKOUT_MODE === 'manual_prex'
          ? 'MANUAL_PREX'
          : paymentProvider.isMock()
            ? 'MOCK'
            : 'MERCADOPAGO',
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
    if (env.PAYMENTS_CHECKOUT_MODE === 'manual_prex') {
      throw new ValidationError(
        'El cobro MVP es por transferencia Prex. Usá el endpoint de comprobante manual.',
      );
    }

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
        provider: paymentProvider.isMock()
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

    const preference = await paymentProvider.createCheckout({
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

  /**
   * MVP: comprador declara transferencia Prex + sube comprobante.
   * Queda pendiente de revisión admin antes de pasar a FUNDED y visible para agentes.
   */
  async submitManualPrexTransfer(
    userId: string,
    code: string,
    input: { receiptDataUrl: string; receiptFileName?: string },
  ) {
    if (env.PAYMENTS_CHECKOUT_MODE !== 'manual_prex') {
      throw new ValidationError(
        'La transferencia Prex solo está habilitada con PAYMENTS_CHECKOUT_MODE=manual_prex',
      );
    }

    const receipt = input.receiptDataUrl.trim();
    if (!/^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(receipt)) {
      throw new ValidationError(
        'El comprobante debe ser una imagen (JPEG/PNG/WebP) o PDF en data URL base64',
      );
    }
    // ~4MB en base64 ≈ 5.5MB string
    if (receipt.length > 5_500_000) {
      throw new ValidationError('El comprobante es demasiado grande (máx. ~4 MB)');
    }

    const tx = await this.loadTxForParticipant(userId, code);
    const parties = resolveParties(tx);

    if (parties.buyerId !== userId) {
      throw new ForbiddenError('Solo el comprador puede declarar el pago');
    }
    if (tx.status !== TransactionStatus.ACCEPTED) {
      throw new ValidationError(
        `La operación debe estar ACCEPTED para pagar (actual: ${tx.status})`,
      );
    }
    assertNotPastDeadline(tx);

    const existingCaptured = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      status: { $in: [PaymentStatus.CAPTURED, PaymentStatus.RELEASED] },
      deletedAt: null,
    }).exec();
    if (existingCaptured) {
      throw new ValidationError('La operación ya tiene el pago protegido');
    }

    const currency = assertAppCurrency(tx.currency ?? defaultCurrency());
    const split = this.splitForTransaction(tx);
    const amountDue = buyerAmountDueCents(tx, split);
    const productCents = split.productCents;

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
    let hold = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      idempotencyKey,
      deletedAt: null,
    }).exec();

    if (!hold) {
      hold = await PaymentModel.create({
        transaction: tx._id,
        payer: new Types.ObjectId(parties.buyerId),
        payee: new Types.ObjectId(parties.sellerId),
        type: PaymentType.ESCROW_HOLD,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.MANUAL_PREX,
        amountCents: amountDue,
        currency,
        idempotencyKey,
        metadata: {
          split,
          phase: 'manual_prex_pending',
          checkoutMode: 'manual_prex',
        },
      });
    } else if (
      hold.status === PaymentStatus.CAPTURED ||
      hold.status === PaymentStatus.RELEASED
    ) {
      throw new ValidationError('La operación ya tiene el pago protegido');
    } else {
      hold.amountCents = amountDue;
      hold.provider = PaymentProvider.MANUAL_PREX;
    }

    const prex = prexAccountDto();
    hold.externalId = hold.externalId || `PREX-${tx.code}`;
    hold.status = PaymentStatus.REQUIRES_ACTION;
    hold.metadata = {
      ...(hold.metadata ?? {}),
      split,
      phase: 'manual_prex_receipt',
      checkoutMode: 'manual_prex',
      prexAccount: prex,
      receiptFileName: input.receiptFileName?.slice(0, 180),
      receiptDataUrl: receipt,
      receiptUploadedAt: new Date().toISOString(),
      amountDueCents: amountDue,
      transactionCode: tx.code,
    };
    await hold.save();

    await persistLog({
      source: 'confirm',
      event: 'manual_prex.receipt_submitted',
      message: 'Comprobante Prex recibido — pendiente de confirmación admin',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      externalId: hold.externalId,
      payload: {
        code: tx.code,
        amountCents: amountDue,
        receiptFileName: input.receiptFileName,
        prex,
      },
    });

    auditService.track({
      actor: userId,
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'manual_prex_receipt',
        code: tx.code,
        amountCents: amountDue,
        provider: PaymentProvider.MANUAL_PREX,
        receiptFileName: input.receiptFileName,
        pendingAdminReview: true,
        ...feesAuditMeta(split),
      },
    });

    const now = new Date();
    tx.statusHistory.push({
      status: TransactionStatus.ACCEPTED,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: 'Comprador envió el comprobante de transferencia — pendiente de verificación',
    });
    await tx.save();

    const buyer = await UserModel.findById(parties.buyerId).select('email fullName').lean();
    setImmediate(() => {
      void sendManualPrexReceiptEmail({
        transactionCode: tx.code,
        transactionTitle: tx.title,
        amountCents: amountDue,
        currency,
        buyerName: buyer?.fullName ?? 'Comprador',
        buyerEmail: buyer?.email ?? '',
        receiptDataUrl: receipt,
        receiptFileName: input.receiptFileName,
        prexAccountName: prex.accountName,
        prexAccountNumber: prex.accountNumber,
        paymentId: String(hold._id),
      });
    });

    return {
      payment: toPaymentDto(hold.toObject()),
      transactionCode: tx.code,
      transactionStatus: tx.status,
      split,
      amountDueCents: amountDue,
      checkoutMode: 'manual_prex' as const,
      prexAccount: prex,
      providerMode: 'MANUAL_PREX' as const,
      pendingAdminReview: true,
    };
  }

  /** Admin confirma o revierte la transferencia Prex tras revisar el comprobante. */
  async setManualPrexAdminConfirmation(
    adminUserId: string,
    paymentId: string,
    confirmed: boolean,
  ) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new NotFoundError('Pago no encontrado');
    }

    const hold = await PaymentModel.findOne({
      _id: paymentId,
      type: PaymentType.ESCROW_HOLD,
      provider: PaymentProvider.MANUAL_PREX,
      deletedAt: null,
    }).exec();
    if (!hold) throw new NotFoundError('Transferencia Prex no encontrada');

    const tx = await TransactionModel.findById(hold.transaction).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const meta = (hold.metadata ?? {}) as Record<string, unknown>;
    const hasReceipt = typeof meta.receiptDataUrl === 'string' && meta.receiptDataUrl.length > 0;
    if (!hasReceipt) {
      throw new ValidationError('No hay comprobante para confirmar en esta transferencia');
    }

    const currentlyConfirmed = isManualPrexAdminConfirmed(hold.status, meta);
    if (confirmed === currentlyConfirmed) {
      return {
        payment: toPaymentDto(hold.toObject()),
        transactionCode: tx.code,
        transactionStatus: tx.status,
        adminConfirmed: currentlyConfirmed,
        unchanged: true as const,
      };
    }

    if (confirmed) {
      const result = await this.confirmHold(String(hold._id), {
        source: 'confirm',
        externalPaymentId: hold.externalId,
        note: 'Pago protegido confirmado por admin tras revisar comprobante Prex',
      });

      const refreshed = await PaymentModel.findById(hold._id).exec();
      if (refreshed) {
        const now = new Date();
        refreshed.metadata = {
          ...(refreshed.metadata ?? {}),
          adminConfirmedAt: now.toISOString(),
          adminConfirmedBy: adminUserId,
          phase: 'manual_prex_admin_confirmed',
        };
        await refreshed.save();
      }

      const updatedTx = await TransactionModel.findById(tx._id).select('status').lean().exec();

      auditService.track({
        actor: adminUserId,
        action: AuditAction.PAYMENT_UPDATED,
        entityType: 'Payment',
        entityId: String(hold._id),
        outcome: AuditOutcome.SUCCESS,
        correlationId: tx.code,
        metadata: {
          phase: 'manual_prex_admin_confirmed',
          code: tx.code,
          amountCents: hold.amountCents,
          provider: PaymentProvider.MANUAL_PREX,
        },
      });

      await persistLog({
        source: 'system',
        event: 'manual_prex.admin_confirmed',
        message: 'Admin confirmó comprobante Prex — operación disponible para agentes',
        transactionId: String(tx._id),
        paymentId: String(hold._id),
        externalId: hold.externalId,
        payload: { code: tx.code, adminUserId },
      });

      return {
        ...result,
        payment: toPaymentDto((refreshed ?? hold).toObject()),
        transactionCode: tx.code,
        transactionStatus: updatedTx?.status ?? tx.status,
        adminConfirmed: true,
      };
    }

    const hasAgent = tx.participants.some(
      (p) =>
        p.role === ParticipantRole.INTERMEDIARY &&
        (p.status === ParticipantStatus.ACCEPTED ||
          p.status === ParticipantStatus.INVITED),
    );
    if (hasAgent) {
      throw new ValidationError(
        'No se puede marcar como no confirmada: ya hay un agente asignado o invitado',
      );
    }

    if (
      hold.status !== PaymentStatus.CAPTURED &&
      hold.status !== PaymentStatus.RELEASED
    ) {
      throw new ValidationError('La transferencia aún no fue confirmada por admin');
    }

    const parties = resolveParties(tx);
    const now = new Date();

    await UserModel.updateOne(
      { _id: parties.sellerId, 'wallet.status': { $ne: WalletStatus.CLOSED } },
      {
        $inc: { 'wallet.heldCents': -hold.amountCents },
        $set: { 'wallet.lastMovementAt': now },
      },
    ).exec();

    const sellerAfter = await UserModel.findById(parties.sellerId).select('wallet').lean();
    await walletLedger.record({
      userId: parties.sellerId,
      type: WalletMovementType.ESCROW_HOLD,
      direction: WalletMovementDirection.DEBIT,
      amountCents: hold.amountCents,
      currency: hold.currency,
      description: `Reversión retención escrow ${tx.code} (admin desconfirmó Prex)`,
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

    hold.status = PaymentStatus.REQUIRES_ACTION;
    hold.set('capturedAt', undefined);
    hold.set('authorizedAt', undefined);
    const nextMeta = { ...meta, phase: 'manual_prex_receipt' } as Record<string, unknown>;
    delete nextMeta.adminConfirmedAt;
    delete nextMeta.adminConfirmedBy;
    hold.metadata = nextMeta;
    await hold.save();

    if (tx.status === TransactionStatus.FUNDED) {
      tx.status = TransactionStatus.ACCEPTED;
      tx.fundedAt = undefined;
      tx.statusHistory.push({
        status: TransactionStatus.ACCEPTED,
        changedAt: now,
        changedBy: new Types.ObjectId(adminUserId),
        note: 'ConfiApp pidió revisar de nuevo el comprobante de la transferencia',
      });
      await tx.save();
    }

    auditService.track({
      actor: adminUserId,
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'manual_prex_admin_unconfirmed',
        code: tx.code,
        amountCents: hold.amountCents,
        provider: PaymentProvider.MANUAL_PREX,
      },
    });

    await persistLog({
      source: 'system',
      event: 'manual_prex.admin_unconfirmed',
      message: 'Admin marcó transferencia Prex como no confirmada',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      externalId: hold.externalId,
      payload: { code: tx.code, adminUserId },
    });

    return {
      payment: toPaymentDto(hold.toObject()),
      transactionCode: tx.code,
      transactionStatus: tx.status,
      adminConfirmed: false,
    };
  }

  /** Confirmación MOCK (dev) o llamada interna post-webhook aprobado. */
  async confirmHold(
    paymentId: string,
    opts: {
      externalPaymentId?: string;
      source: 'webhook' | 'confirm';
      note?: string;
    },
  ) {
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
      const isManualPrex = hold.provider === PaymentProvider.MANUAL_PREX;
      hold.metadata = {
        ...(hold.metadata ?? {}),
        ...(isManualPrex
          ? { prexReference: opts.externalPaymentId }
          : { mpPaymentId: opts.externalPaymentId }),
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
        note:
          opts.note ??
          'Pago protegido confirmado con Mercado Pago',
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
    if (!paymentProvider.isMock()) {
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

    const signatureOk = paymentProvider.verifyWebhookSignature({
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

    const mpPayment = await paymentProvider.getPayment(dataId);
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

    // Flujo con verificación del Agente: hace falta la doble confirmación de entrega.
    if (tx.agentVerification?.buyerDecision === 'ACCEPTED') {
      const buyerOk = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
      const agentOk = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
      if (!buyerOk || !agentOk) {
        throw new ValidationError(
          'Para liberar los fondos, el comprador debe confirmar el arribo y el Agente la entrega.',
          { buyerArrivalConfirmed: buyerOk, agentDeliveryConfirmed: agentOk },
        );
      }
    } else if (tx.agentVerification?.completedAt && !tx.agentVerification.buyerDecision) {
      throw new ValidationError(
        'El comprador todavía no decidió si acepta el producto tras la verificación.',
      );
    }

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
        status: PaymentStatus.CAPTURED,
        provider,
        amountCents: agentFee,
        currency,
        idempotencyKey: `agent:${String(tx._id)}`,
        capturedAt: now,
        metadata: {
          split,
          bps: env.PAYMENTS_AGENT_FEE_BPS,
          holdDays: 21,
          accounting: 'PENDING_COMMISSION',
        },
      });

      await agentCommissionService.recordOnCompleted({
        transactionId: String(tx._id),
        transactionCode: tx.code,
        agentId: parties.agentId,
        commissionCents: split.commissionCents,
        agentShareCents: agentFee,
        platformShareCents: platformFee,
        currency,
        completedAt: now,
        paymentId: String(agentPayment._id),
        actorId: userId,
        metadata: { split },
      });

      await financialAudit.record({
        action: 'ESCROW_RELEASED',
        idempotencyKey: `fa:release:${String(tx._id)}`,
        operationId: String(tx._id),
        paymentId: String(agentPayment._id),
        agentId: parties.agentId,
        actorId: userId,
        amountCents: agentFee,
        currency,
        newStatus: 'COMPLETED',
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
    const autoReleased = Boolean(
      tx.deliveryConfirmation?.buyerArrivalAuto || tx.deliveryConfirmation?.agentDeliveryAuto,
    );
    tx.statusHistory.push({
      status: TransactionStatus.COMPLETED,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: autoReleased
        ? 'Fondos liberados al vendedor (confirmación automática tras 72h)'
        : 'Fondos liberados al vendedor',
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

    void this.dispatchReleaseSideEffects(tx, parties, autoReleased).catch((error) => {
      logger.error('releaseEscrow side effects failed', { error, code: tx.code });
    });

    return {
      transactionStatus: tx.status,
      split,
      release: toPaymentDto(release.toObject()),
      platformFee: toPaymentDto(fee.toObject()),
      agentPayout: agentPayment ? toPaymentDto(agentPayment.toObject()) : null,
    };
  }

  /** Reputación y notificaciones post-liberación (no bloquean la respuesta HTTP). */
  private async dispatchReleaseSideEffects(
    tx: TransactionDocument,
    parties: ReturnType<typeof resolveParties>,
    autoReleased: boolean,
  ): Promise<void> {
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

    const partyBody = (uid: string): string => {
      if (uid === parties.sellerId) {
        return autoReleased
          ? `Se liberaron los fondos de ${tx.code} automáticamente tras 72h. El neto ya está en tu wallet disponible.`
          : `Se liberaron los fondos de ${tx.code}. El neto ya está en tu wallet disponible.`;
      }
      if (uid === parties.agentId) {
        return autoReleased
          ? `Se acreditó tu comisión de intermediación en ${tx.code} (liberación automática). Estará disponible para retiro en 21 días.`
          : `Se acreditó tu comisión de intermediación en ${tx.code}. Estará disponible para retiro en 21 días.`;
      }
      return autoReleased
        ? `La operación ${tx.code} se completó con liberación automática de fondos al vendedor.`
        : `La operación ${tx.code} se completó y los fondos fueron liberados al vendedor.`;
    };

    await Promise.all(
      releaseNotifyIds.map((uid) =>
        notificationsService.notify({
          userId: uid,
          type: NotificationType.PAYMENT,
          title: autoReleased ? 'Operación completada automáticamente' : 'Operación completada',
          body: partyBody(uid),
          data: {
            href,
            code: tx.code,
            status: TransactionStatus.COMPLETED,
            step: 'escrow_released',
            autoRelease: autoReleased,
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );

    const admins = await UserModel.find({
      deletedAt: null,
      $or: [{ role: PlatformRole.ADMIN }, { roles: PlatformRole.ADMIN }],
    })
      .select('_id')
      .lean()
      .exec();

    await Promise.all(
      admins.map((admin) =>
        notificationsService.notify({
          userId: String(admin._id),
          type: NotificationType.PAYMENT,
          title: `Fondos liberados · ${tx.code}`,
          body: autoReleased
            ? `Liberación automática tras 72h: neto del vendedor en wallet; comisión del agente pendiente 21 días.`
            : `Neto del vendedor acreditado en wallet; comisión del agente pendiente 21 días.`,
          data: {
            href: '/admin/finanzas',
            code: tx.code,
            status: TransactionStatus.COMPLETED,
            step: 'escrow_released',
            autoRelease: autoReleased,
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );
  }

  /**
   * Reembolso total del hold + cancelación de la operación
   * (p. ej. comprador rechaza el producto tras la verificación del Agente).
   */
  async refundEscrowAndCancel(userId: string, code: string, note?: string) {
    const tx = await this.loadTxForParticipant(userId, code);
    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        `Solo se puede reembolsar con pago protegido o en curso (actual: ${tx.status})`,
      );
    }
    assertNotPastDeadline(tx);
    assertTransition(tx.status, TransactionStatus.CANCELLED);

    const parties = resolveParties(tx);
    const hold = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      status: PaymentStatus.CAPTURED,
      deletedAt: null,
    }).exec();
    if (!hold) throw new ValidationError('No hay fondos retenidos para reembolsar');

    const alreadyReleased = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_RELEASE,
      status: { $in: [PaymentStatus.RELEASED, PaymentStatus.CAPTURED] },
      deletedAt: null,
    }).lean();
    if (alreadyReleased) {
      throw new ValidationError('El pago protegido ya fue liberado; no se puede reembolsar así');
    }

    const now = new Date();

    if (hold.externalId && hold.provider !== PaymentProvider.MANUAL_PREX) {
      try {
        await paymentProvider.refundPayment(hold.externalId);
      } catch (error) {
        logger.error('refundPayment failed', { error, code: tx.code, externalId: hold.externalId });
        throw new ValidationError(
          'No se pudo procesar el reembolso con el proveedor de pagos. Intentá de nuevo o contactá soporte.',
        );
      }
    }

    await UserModel.updateOne(
      { _id: parties.sellerId, 'wallet.status': { $ne: WalletStatus.CLOSED } },
      {
        $inc: { 'wallet.heldCents': -hold.amountCents },
        $set: { 'wallet.lastMovementAt': now },
      },
    ).exec();

    const sellerAfter = await UserModel.findById(parties.sellerId).select('wallet').lean();
    await walletLedger.record({
      userId: parties.sellerId,
      type: WalletMovementType.REFUND,
      direction: WalletMovementDirection.DEBIT,
      amountCents: hold.amountCents,
      currency: hold.currency,
      description: `Reembolso escrow · ${tx.code}`,
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

    hold.status = PaymentStatus.REFUNDED;
    hold.refundedAt = now;
    hold.metadata = {
      ...(hold.metadata ?? {}),
      phase: 'refunded',
      refundReason: 'buyer_rejected_product',
      refundedBy: userId,
      manualPrex:
        hold.provider === PaymentProvider.MANUAL_PREX
          ? 'Reembolso manual pendiente (Prex)'
          : undefined,
    };
    await hold.save();

    try {
      await agentCommissionService.reverseForTransaction(String(tx._id), 'REFUND_TOTAL');
    } catch (error) {
      logger.error('reverseForTransaction on buyer reject failed', { error, code: tx.code });
    }

    tx.status = TransactionStatus.CANCELLED;
    tx.statusHistory.push({
      status: TransactionStatus.CANCELLED,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: note ?? 'Comprador rechazó el producto y canceló la compra',
    });
    await tx.save();

    await persistLog({
      source: 'system',
      event: 'escrow.refunded',
      message: 'Pago protegido reembolsado tras rechazo del comprador',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      payload: {
        code: tx.code,
        refundedBy: userId,
        provider: hold.provider,
        amountCents: hold.amountCents,
      },
    });

    auditService.track({
      actor: userId,
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'escrow_refunded',
        code: tx.code,
        step: 'buyer_rejected_product',
        amountCents: hold.amountCents,
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
        step: 'buyer_rejected_product',
        to: TransactionStatus.CANCELLED,
      },
    });

    const href = `/operaciones/${tx.code}`;
    const notifyIds = [parties.buyerId, parties.sellerId, parties.agentId].filter(
      (id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx,
    );

    await Promise.all(
      notifyIds.map((uid) =>
        notificationsService.notify({
          userId: uid,
          type: NotificationType.PAYMENT,
          title: 'Compra cancelada',
          body:
            uid === parties.buyerId
              ? `Rechazaste el producto de ${tx.code}. Se inició el reembolso del pago protegido.`
              : uid === parties.sellerId
                ? `El comprador rechazó el producto en ${tx.code}. La operación se canceló.`
                : `El comprador rechazó el producto en ${tx.code}. Coordiná la devolución si corresponde.`,
          data: {
            href,
            code: tx.code,
            status: TransactionStatus.CANCELLED,
            step: 'buyer_rejected_product',
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );

    return {
      transactionStatus: tx.status,
      payment: toPaymentDto(hold.toObject()),
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

  /** Admin: transferencias Prex declaradas por compradores (sin payload pesado del comprobante). */
  async listManualPrexTransfersForAdmin(opts?: { page?: number; limit?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 15, 1), 200);
    const page = Math.max(opts?.page ?? 1, 1);
    const filter = {
      provider: PaymentProvider.MANUAL_PREX,
      type: PaymentType.ESCROW_HOLD,
      deletedAt: null,
    };

    const [total, payments] = await Promise.all([
      PaymentModel.countDocuments(filter).exec(),
      PaymentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const txIds = [...new Set(payments.map((p) => String(p.transaction)))];
    const payerIds = [...new Set(payments.map((p) => String(p.payer)))];

    const [transactions, payers] = await Promise.all([
      TransactionModel.find({ _id: { $in: txIds } })
        .select('code title status currency')
        .lean()
        .exec(),
      UserModel.find({ _id: { $in: payerIds } })
        .select('email fullName')
        .lean()
        .exec(),
    ]);

    const txById = new Map(transactions.map((tx) => [String(tx._id), tx]));
    const payerById = new Map(payers.map((u) => [String(u._id), u]));

    return {
      checkoutMode: env.PAYMENTS_CHECKOUT_MODE,
      prexAccount: prexAccountDto(),
      items: payments.map((p) => {
        const meta = (p.metadata ?? {}) as Record<string, unknown>;
        const tx = txById.get(String(p.transaction));
        const payer = payerById.get(String(p.payer));
        const receiptDataUrl =
          typeof meta.receiptDataUrl === 'string' ? meta.receiptDataUrl : undefined;
        return {
          id: String(p._id),
          transactionId: String(p.transaction),
          transactionCode: tx?.code ?? (meta.transactionCode as string | undefined),
          transactionTitle: tx?.title,
          transactionStatus: tx?.status,
          status: p.status,
          amountCents: p.amountCents,
          currency: p.currency,
          externalId: p.externalId,
          capturedAt: p.capturedAt?.toISOString(),
          createdAt: p.createdAt.toISOString(),
          buyer: payer
            ? { id: String(payer._id), email: payer.email, fullName: payer.fullName }
            : { id: String(p.payer) },
          receiptFileName:
            typeof meta.receiptFileName === 'string' ? meta.receiptFileName : undefined,
          receiptUploadedAt:
            typeof meta.receiptUploadedAt === 'string' ? meta.receiptUploadedAt : undefined,
          hasReceipt: Boolean(receiptDataUrl),
          adminConfirmed: isManualPrexAdminConfirmed(p.status, meta),
        };
      }),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /** Admin: detalle con comprobante (data URL) para revisión. */
  async getManualPrexTransferForAdmin(paymentId: string) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new NotFoundError('Pago no encontrado');
    }
    const payment = await PaymentModel.findOne({
      _id: paymentId,
      provider: PaymentProvider.MANUAL_PREX,
      type: PaymentType.ESCROW_HOLD,
      deletedAt: null,
    })
      .lean()
      .exec();
    if (!payment) throw new NotFoundError('Transferencia Prex no encontrada');

    const [tx, payer] = await Promise.all([
      TransactionModel.findById(payment.transaction)
        .select('code title status currency amountCents')
        .lean()
        .exec(),
      UserModel.findById(payment.payer).select('email fullName phone').lean().exec(),
    ]);

    const meta = (payment.metadata ?? {}) as Record<string, unknown>;
    const receiptDataUrl =
      typeof meta.receiptDataUrl === 'string' ? meta.receiptDataUrl : undefined;

    return {
      payment: {
        id: String(payment._id),
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        externalId: payment.externalId,
        capturedAt: payment.capturedAt?.toISOString(),
        createdAt: payment.createdAt.toISOString(),
        receiptFileName:
          typeof meta.receiptFileName === 'string' ? meta.receiptFileName : undefined,
        receiptUploadedAt:
          typeof meta.receiptUploadedAt === 'string' ? meta.receiptUploadedAt : undefined,
        receiptDataUrl,
        prexAccount:
          meta.prexAccount && typeof meta.prexAccount === 'object'
            ? meta.prexAccount
            : prexAccountDto(),
        adminConfirmed: isManualPrexAdminConfirmed(payment.status, meta),
        adminConfirmedAt:
          typeof meta.adminConfirmedAt === 'string' ? meta.adminConfirmedAt : undefined,
        adminConfirmedBy:
          typeof meta.adminConfirmedBy === 'string' ? meta.adminConfirmedBy : undefined,
      },
      transaction: tx
        ? {
            id: String(tx._id),
            code: tx.code,
            title: tx.title,
            status: tx.status,
            currency: tx.currency,
            amountCents: tx.amountCents,
          }
        : null,
      buyer: payer
        ? {
            id: String(payer._id),
            email: payer.email,
            fullName: payer.fullName,
            phone: payer.phone,
          }
        : { id: String(payment.payer) },
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
