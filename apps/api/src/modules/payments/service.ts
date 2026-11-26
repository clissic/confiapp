import {
  FundingMode,
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
import { AGENT_COMMISSION_HOLD_DAYS, AGENT_FEE_ONLY_UYU_CENTS } from '@confiapp/shared';
import { Types, type HydratedDocument } from 'mongoose';

import { PaymentEventLogModel } from '../../database/models/payment-event-log.model';
import { PaymentModel, TransactionModel, UserModel } from '../../database/models';
import { paymentProvider } from '../../infrastructure/payments/mercadopago.payment-provider';
import { mercadoPagoClient } from '../../infrastructure/payments/mercadopago.client';
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
import {
  computeEscrowSplit,
  IntermediationFeeError,
  type EscrowSplit,
  type FeePayer,
} from './split';
import { resolveCheckoutUrl, resolveReusableCheckoutUrl } from './checkout-url';

export type PaymentDocument = HydratedDocument<IPayment>;
type TransactionDocument = HydratedDocument<ITransaction>;

function resolvePaymentFundingMode(
  value?: FundingMode | string | null,
): FundingMode {
  if (value === FundingMode.AGENT_FEE_ONLY) return FundingMode.AGENT_FEE_ONLY;
  if (value === FundingMode.ESCROW_FULL && env.FUNDING_ESCROW_FULL_ENABLED) {
    return FundingMode.ESCROW_FULL;
  }
  return FundingMode.AGENT_FEE_ONLY;
}

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

/** Monto que debe pagar el comprador ahora. */
function buyerAmountDueCents(
  tx: {
    amountCents?: number;
    currency?: string;
    feePayer?: FeePayer | string | null;
    initiatedBy?: TransactionInitiator | string;
    confiAnzaCents?: number;
    confiAnzaCurrency?: string;
    fundingMode?: FundingMode | string | null;
  },
  split: EscrowSplit,
): number {
  if (resolvePaymentFundingMode(tx.fundingMode) === FundingMode.AGENT_FEE_ONLY) {
    return AGENT_FEE_ONLY_UYU_CENTS;
  }

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

const PAYMENT_LOG_PAYLOAD_MAX_CHARS = 4_000;

function truncateLogPayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  try {
    const raw = JSON.stringify(payload);
    if (raw.length <= PAYMENT_LOG_PAYLOAD_MAX_CHARS) return payload;
    return {
      truncated: true,
      preview: raw.slice(0, PAYMENT_LOG_PAYLOAD_MAX_CHARS),
    };
  } catch {
    return { truncated: true, error: 'unserializable_payload' };
  }
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
  const payload = truncateLogPayload(input.payload);
  logger[level](input.message, {
    domain: 'payments',
    event: input.event,
    transactionId: input.transactionId,
    paymentId: input.paymentId,
    externalId: input.externalId,
    payload,
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
      payload,
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
    const fundingMode = resolvePaymentFundingMode(tx.fundingMode);
    const currency =
      fundingMode === FundingMode.AGENT_FEE_ONLY
        ? 'UYU'
        : assertAppCurrency(tx.currency ?? defaultCurrency());
    const split = this.splitForTransaction(tx);
    const amountDue = buyerAmountDueCents(tx, split);
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
      grossCents: amountDue,
      amountDueCents: amountDue,
      productCents:
        fundingMode === FundingMode.AGENT_FEE_ONLY ? 0 : split.productCents,
      commissionCents:
        fundingMode === FundingMode.AGENT_FEE_ONLY
          ? AGENT_FEE_ONLY_UYU_CENTS
          : split.commissionCents,
      feePayer: split.feePayer,
      split:
        fundingMode === FundingMode.AGENT_FEE_ONLY
          ? {
              ...split,
              productCents: 0,
              commissionCents: AGENT_FEE_ONLY_UYU_CENTS,
              buyerPaysCents: AGENT_FEE_ONLY_UYU_CENTS,
              sellerNetCents: 0,
              platformFeeCents: Math.floor(
                (AGENT_FEE_ONLY_UYU_CENTS * env.PAYMENTS_PLATFORM_FEE_BPS) / 10_000,
              ),
              agentFeeCents:
                AGENT_FEE_ONLY_UYU_CENTS -
                Math.floor(
                  (AGENT_FEE_ONLY_UYU_CENTS * env.PAYMENTS_PLATFORM_FEE_BPS) / 10_000,
                ),
              currency: 'UYU' as const,
              feePayer: 'BUYER' as const,
            }
          : split,
      parties,
      checkoutMode: 'mercadopago' as const,
      providerMode: paymentProvider.isMock() ? 'MOCK' : 'MERCADOPAGO',
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
    const fundingMode = resolvePaymentFundingMode(tx.fundingMode);

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
      throw new ValidationError(
        fundingMode === FundingMode.AGENT_FEE_ONLY
          ? 'La contratación del Agente ya está paga'
          : 'La operación ya tiene el servicio del Agente pagado',
      );
    }
    assertNotPastDeadline(tx);

    if (fundingMode === FundingMode.AGENT_FEE_ONLY) {
      return this.createAgentFeeOnlyCheckout(userId, tx, parties);
    }

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
      throw new ValidationError('Ya existe una contratación del Agente capturada para esta operación');
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
          fundingMode,
          country: env.MERCADOPAGO_COUNTRY,
          siteId: env.MERCADOPAGO_SITE_ID,
        },
      }));

    if (existingHold && hold.amountCents !== buyerPays) {
      hold.amountCents = buyerPays;
    }

    const meta = (hold.metadata ?? {}) as Record<string, unknown>;
    const reusedPreferenceId =
      typeof meta.preferenceId === 'string' ? meta.preferenceId : undefined;
    const reusedInitPoint = resolveReusableCheckoutUrl(meta);
    if (
      existingHold &&
      hold.status === PaymentStatus.REQUIRES_ACTION &&
      reusedPreferenceId &&
      reusedInitPoint &&
      hold.amountCents === buyerPays
    ) {
      return {
        payment: toPaymentDto(hold.toObject()),
        checkoutUrl: reusedInitPoint,
        preferenceId: reusedPreferenceId,
        split,
        providerMode: hold.provider === PaymentProvider.MOCK ? 'MOCK' : 'MERCADOPAGO',
      };
    }

    const externalReference = String(hold._id);
    const notificationUrl = `${env.API_PUBLIC_URL}/payments/webhooks/mercadopago`;
    const backBase = `${env.APP_URL}/operaciones/${encodeURIComponent(tx.code)}`;

    const preference = await paymentProvider.createCheckout({
      items: [
        {
          title: `Servicio del Agente ConfiApp ${tx.code} — ${tx.title}`.slice(0, 250),
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
      fundingMode,
      transactionCode: tx.code,
    };
    await hold.save();

    await persistLog({
      source: 'checkout',
      event: 'checkout.created',
      message: 'Checkout comprador creado (servicio del Agente)',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      externalId: preference.id,
      payload: { code: tx.code, split, provider: hold.provider, fundingMode },
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
        fundingMode,
        ...feesAuditMeta(split),
      },
    });

    return {
      payment: toPaymentDto(hold.toObject()),
      checkoutUrl: resolveCheckoutUrl(preference) ?? preference.initPoint,
      preferenceId: preference.id,
      split,
      providerMode: preference.provider,
    };
  }

  /**
   * Contratación del Agente (UYU $490) → preferencia a cuenta ConfiApp (retención).
   */
  private async createAgentFeeOnlyCheckout(
    userId: string,
    tx: TransactionDocument,
    parties: ReturnType<typeof resolveParties>,
  ) {
    if (!parties.agentId) {
      throw new ValidationError(
        'Primero debe asignarse un Agente para poder pagar la contratación.',
      );
    }

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
      throw new ValidationError('La contratación del Agente ya está paga');
    }

    const currency = 'UYU';
    const buyerPays = AGENT_FEE_ONLY_UYU_CENTS;
    const platformFeeCents = Math.floor(
      (buyerPays * env.PAYMENTS_PLATFORM_FEE_BPS) / 10_000,
    );
    const agentFeeCents = buyerPays - platformFeeCents;

    if (!tx.currency) {
      tx.currency = currency;
      await tx.save();
    }

    const idempotencyKey = `agent-fee:${String(tx._id)}`;
    const splitMeta = {
      fundingMode: FundingMode.AGENT_FEE_ONLY,
      productCents: 0,
      commissionCents: buyerPays,
      buyerPaysCents: buyerPays,
      sellerNetCents: 0,
      platformFeeCents,
      agentFeeCents,
      currency,
      feePayer: 'BUYER' as const,
    };

    let hold =
      existingHold ??
      (await PaymentModel.create({
        transaction: tx._id,
        payer: new Types.ObjectId(parties.buyerId),
        // Beneficiario contable del Agente; el cobro MP es a cuenta ConfiApp.
        payee: new Types.ObjectId(parties.agentId),
        type: PaymentType.ESCROW_HOLD,
        status: PaymentStatus.PENDING,
        provider: paymentProvider.isMock()
          ? PaymentProvider.MOCK
          : PaymentProvider.MERCADOPAGO,
        amountCents: buyerPays,
        currency,
        idempotencyKey,
        metadata: {
          ...splitMeta,
          phase: 'retention',
          country: env.MERCADOPAGO_COUNTRY,
          siteId: env.MERCADOPAGO_SITE_ID,
        },
      }));

    if (existingHold) {
      hold.amountCents = buyerPays;
    }

    const feeMeta = (hold.metadata ?? {}) as Record<string, unknown>;
    const reusedFeePreferenceId =
      typeof feeMeta.preferenceId === 'string' ? feeMeta.preferenceId : undefined;
    const reusedFeeInitPoint = resolveReusableCheckoutUrl(feeMeta);
    if (
      existingHold &&
      hold.status === PaymentStatus.REQUIRES_ACTION &&
      reusedFeePreferenceId &&
      reusedFeeInitPoint &&
      hold.amountCents === buyerPays
    ) {
      return {
        payment: toPaymentDto(hold.toObject()),
        checkoutUrl: reusedFeeInitPoint,
        preferenceId: reusedFeePreferenceId,
        split: splitMeta,
        providerMode: hold.provider === PaymentProvider.MOCK ? 'MOCK' : 'MERCADOPAGO',
      };
    }

    const externalReference = String(hold._id);
    const notificationUrl = `${env.API_PUBLIC_URL}/payments/webhooks/mercadopago`;
    const backBase = `${env.APP_URL}/operaciones/${encodeURIComponent(tx.code)}`;

    const preference = await paymentProvider.createCheckout({
      items: [
        {
          title: `Contratación Agente ConfiApp ${tx.code}`.slice(0, 250),
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
      ...splitMeta,
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      phase: 'retention',
      fundingMode: FundingMode.AGENT_FEE_ONLY,
      transactionCode: tx.code,
      agentId: parties.agentId,
    };
    await hold.save();

    await persistLog({
      source: 'checkout',
      event: 'checkout.created',
      message: 'Checkout contratación Agente creado (retención ConfiApp)',
      transactionId: String(tx._id),
      paymentId: String(hold._id),
      externalId: preference.id,
      payload: {
        code: tx.code,
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        amountCents: buyerPays,
        platformFeeCents,
        provider: hold.provider,
      },
    });

    auditService.track({
      actor: userId,
      action: existingHold ? AuditAction.PAYMENT_UPDATED : AuditAction.PAYMENT_CREATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: 'agent_fee_checkout_created',
        code: tx.code,
        amountCents: buyerPays,
        platformFeeCents,
        agentFeeCents,
        provider: hold.provider,
        preferenceId: preference.id,
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        reusedExisting: Boolean(existingHold),
      },
    });

    return {
      payment: toPaymentDto(hold.toObject()),
      checkoutUrl: resolveCheckoutUrl(preference) ?? preference.initPoint,
      preferenceId: preference.id,
      split: splitMeta,
      providerMode: preference.provider,
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

    const parties = resolveParties(tx);
    const isAgentFeeOnly =
      resolvePaymentFundingMode(tx.fundingMode) === FundingMode.AGENT_FEE_ONLY;

    // Retención en wallet del vendedor solo en escrow completo (producto).
    if (!isAgentFeeOnly) {
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
        description: `Contratación retenida · ${tx.code}`,
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
    }

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
          (isAgentFeeOnly
            ? 'Contratación del Agente confirmada con Mercado Pago'
            : 'Servicio del Agente pagado con Mercado Pago'),
      });

      // Si el Agente ya estaba asignado, pasar a en curso.
      if (parties.agentId) {
        assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
        tx.status = TransactionStatus.IN_PROGRESS;
        tx.statusHistory.push({
          status: TransactionStatus.IN_PROGRESS,
          changedAt: now,
          changedBy: hold.payer,
          note: 'Operación en curso tras pago de la contratación del Agente',
        });
      }

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

    const feeSnap = isAgentFeeOnly
      ? null
      : this.splitForTransaction(tx);
    auditService.track({
      actor: String(hold.payer),
      action: AuditAction.PAYMENT_UPDATED,
      entityType: 'Payment',
      entityId: String(hold._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        phase: isAgentFeeOnly ? 'agent_fee_captured' : 'hold_captured',
        fundingMode: tx.fundingMode,
        code: tx.code,
        amountCents: hold.amountCents,
        transactionId: String(tx._id),
        status: hold.status,
        ...(feeSnap ? feesAuditMeta(feeSnap) : {}),
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
          ...(feeSnap ? feesAuditMeta(feeSnap) : {}),
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
            title: 'Servicio del Agente pagado',
            body:
              uid === parties.buyerId
                ? `Servicio del Agente pagado en ${tx.code}. La operación puede seguir adelante.`
                : `El comprador pagó el servicio del Agente en ${tx.code}.`,
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

  /**
   * Confirma el hold al volver de Checkout Pro (back_url).
   * Complementa el webhook: en local MP no alcanza localhost; en prod es idempotente.
   */
  async syncCheckoutReturn(
    userId: string,
    code: string,
    input: {
      mpPaymentId?: string;
      externalReference?: string;
      status?: string;
    },
  ) {
    const tx = await this.loadTxForParticipant(userId, code);
    const parties = resolveParties(tx);
    if (parties.buyerId !== userId) {
      throw new ForbiddenError('Solo el comprador puede sincronizar el pago');
    }

    const hold = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!hold) {
      return { confirmed: false, reason: 'no_hold' as const };
    }

    if (
      hold.status === PaymentStatus.CAPTURED ||
      hold.status === PaymentStatus.RELEASED
    ) {
      return {
        confirmed: true,
        alreadyConfirmed: true,
        payment: toPaymentDto(hold.toObject()),
      };
    }

    const mpPaymentId = input.mpPaymentId?.trim();
    const hasPaymentId =
      Boolean(mpPaymentId) && mpPaymentId !== 'null' && mpPaymentId !== 'undefined';

    if (paymentProvider.isMock()) {
      return { confirmed: false, reason: 'mock_mode' as const };
    }

    let mpPayment = hasPaymentId
      ? await paymentProvider.getPayment(mpPaymentId!)
      : null;

    if (!mpPayment || mpPayment.status !== 'approved') {
      const found = await mercadoPagoClient.findApprovedPaymentByExternalReference(
        String(hold._id),
      );
      if (found) {
        mpPayment = found;
      }
    }

    if (!mpPayment) {
      return { confirmed: false, reason: 'missing_payment_id' as const };
    }

    const externalRef =
      mpPayment.externalReference?.trim() ||
      input.externalReference?.trim() ||
      '';

    if (!externalRef || externalRef !== String(hold._id)) {
      await persistLog({
        source: 'confirm',
        event: 'checkout.sync_mismatch',
        level: 'warn',
        message: 'Return MP no coincide con el hold de la operación',
        transactionId: String(tx._id),
        paymentId: String(hold._id),
        externalId: mpPayment.id,
        payload: { externalRef, holdId: String(hold._id), status: mpPayment.status },
      });
      return { confirmed: false, reason: 'reference_mismatch' as const };
    }

    if (mpPayment.status !== 'approved') {
      return {
        confirmed: false,
        reason: 'not_approved' as const,
        mpStatus: mpPayment.status,
      };
    }

    const result = await this.confirmHold(String(hold._id), {
      source: 'confirm',
      externalPaymentId: mpPayment.id,
    });
    return {
      confirmed: true,
      alreadyConfirmed: result.alreadyConfirmed,
      payment: result.payment,
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

    const signatureOk = paymentProvider.verifyWebhookSignature({
      xSignature: input.headers.xSignature,
      xRequestId: input.headers.xRequestId,
      dataId,
    });
    if (!signatureOk) {
      // Solo metadata corta — no persistir body (vector de flood → disco Mongo).
      await persistLog({
        source: 'webhook',
        event: 'webhook.signature_invalid',
        level: 'warn',
        message: 'Firma de webhook inválida',
        externalId: dataId,
        payload: { topic },
      });
      // 200: MP (y el simulador) no deben reintentar. La fuente de verdad sigue siendo
      // getPayment con el Access Token; sin firma no confirmamos más abajo si falla.
      return { handled: false, reason: 'signature_invalid' };
    }

    if (!dataId) {
      return { handled: false, reason: 'missing_data_id' };
    }

    await persistLog({
      source: 'webhook',
      event: 'webhook.received',
      message: 'Webhook Mercado Pago recibido',
      externalId: dataId,
      payload: {
        topic,
        queryKeys: Object.keys(input.query ?? {}),
        bodyKeys: Object.keys(input.body ?? {}),
        action: input.body?.action,
        type: input.body?.type ?? input.query.type ?? input.query.topic,
      },
    });

    const isPaymentTopic =
      topic.includes('payment') || input.body?.action === 'payment.updated';
    if (!isPaymentTopic && topic !== 'unknown') {
      return { handled: false, reason: 'ignored_topic', topic };
    }

    let mpPayment;
    try {
      mpPayment = await paymentProvider.getPayment(dataId);
    } catch (error) {
      // El simulador de MP manda id ficticio (p. ej. 123456). No reventar con 500:
      // MP reintenta ante 5xx; 200 = "recibido, no aplicable".
      await persistLog({
        source: 'webhook',
        event: 'webhook.payment_lookup_failed',
        level: 'warn',
        message: 'No se pudo obtener el pago MP (id inválido o simulador)',
        externalId: dataId,
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return { handled: false, reason: 'payment_lookup_failed', dataId };
    }

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
   * Cierre: descuenta 30% plataforma, acredita comisión del Agente; en ESCROW_FULL también el neto vendedor.
   */
  async releaseEscrow(userId: string, code: string) {
    const tx = await this.loadTxForParticipant(userId, code);
    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        `Solo se puede liquidar con servicio del Agente pagado o en curso (actual: ${tx.status})`,
      );
    }
    assertNotPastDeadline(tx);

    // Flujo con verificación del Agente: hace falta la doble confirmación de entrega.
    if (tx.agentVerification?.buyerDecision === 'ACCEPTED') {
      const buyerOk = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
      const agentOk = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
      if (!buyerOk || !agentOk) {
        throw new ValidationError(
          'Para completar la operación, el comprador debe confirmar el arribo y el Agente la entrega.',
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
    if (!hold) throw new ValidationError('No hay contratación del Agente retenida para completar');

    const alreadyReleased = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_RELEASE,
      status: { $in: [PaymentStatus.RELEASED, PaymentStatus.CAPTURED] },
      deletedAt: null,
    }).lean();
    if (alreadyReleased) {
      throw new ValidationError('La comisión del Agente ya fue liquidada');
    }

    // Solo contratación del Agente: liberar comisión a wallet (sin payout de producto).
    if (resolvePaymentFundingMode(tx.fundingMode) === FundingMode.AGENT_FEE_ONLY) {
      if (!parties.agentId) {
        throw new ValidationError('No hay Agente asignado para acreditar la comisión');
      }

      const meta = (hold.metadata ?? {}) as Record<string, unknown>;
      const buyerPays = hold.amountCents || AGENT_FEE_ONLY_UYU_CENTS;
      const platformFee =
        typeof meta.platformFeeCents === 'number'
          ? Math.max(0, meta.platformFeeCents)
          : Math.floor((buyerPays * env.PAYMENTS_PLATFORM_FEE_BPS) / 10_000);
      const agentFee =
        typeof meta.agentFeeCents === 'number'
          ? Math.max(0, meta.agentFeeCents)
          : Math.max(0, buyerPays - platformFee);
      const currency = hold.currency || 'UYU';
      const now = new Date();
      const provider = hold.provider;
      const split = {
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        productCents: 0,
        commissionCents: buyerPays,
        buyerPaysCents: buyerPays,
        sellerNetCents: 0,
        platformFeeCents: platformFee,
        agentFeeCents: agentFee,
        currency,
        feePayer: 'BUYER' as const,
      };

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
        metadata: { split, bps: env.PAYMENTS_PLATFORM_FEE_BPS, fundingMode: FundingMode.AGENT_FEE_ONLY },
      });

      const agentPayment = await PaymentModel.create({
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
          holdDays: AGENT_COMMISSION_HOLD_DAYS,
          accounting: 'PENDING_COMMISSION',
          fundingMode: FundingMode.AGENT_FEE_ONLY,
        },
      });

      await agentCommissionService.recordOnCompleted({
        transactionId: String(tx._id),
        transactionCode: tx.code,
        agentId: parties.agentId,
        commissionCents: buyerPays,
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

      // Registro de liberación (sin neto a vendedor).
      const release = await PaymentModel.create({
        transaction: tx._id,
        payer: hold.payer,
        payee: new Types.ObjectId(parties.agentId),
        type: PaymentType.ESCROW_RELEASE,
        status: PaymentStatus.RELEASED,
        provider,
        amountCents: Math.max(1, agentFee || 1),
        currency,
        idempotencyKey: `release:${String(tx._id)}`,
        releasedAt: now,
        capturedAt: now,
        metadata: { split, fromHoldId: String(hold._id), fundingMode: FundingMode.AGENT_FEE_ONLY },
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
          ? 'Operación completada (auto 72h) — comisión Agente pendiente en wallet'
          : 'Operación completada — comisión Agente pendiente en wallet',
      });
      await tx.save();

      await persistLog({
        source: 'release',
        event: 'escrow.released',
        message: 'Contratación Agente liberada a comisión PENDING',
        transactionId: String(tx._id),
        paymentId: String(release._id),
        payload: {
          split,
          feePaymentId: String(fee._id),
          agentPaymentId: String(agentPayment._id),
          releasedBy: userId,
          fundingMode: FundingMode.AGENT_FEE_ONLY,
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
          phase: 'agent_fee_only_released',
          fundingMode: FundingMode.AGENT_FEE_ONLY,
          code: tx.code,
          platformFeeId: String(fee._id),
          agentPaymentId: String(agentPayment._id),
          agentFeeCents: agentFee,
          platformFeeCents: platformFee,
        },
      });

      void this.dispatchReleaseSideEffects(tx, parties, autoReleased).catch((error) => {
        logger.error('releaseEscrow side effects failed', { error, code: tx.code });
      });

      return {
        transactionStatus: tx.status,
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        split,
        release: toPaymentDto(release.toObject()),
        platformFee: toPaymentDto(fee.toObject()),
        agentPayout: toPaymentDto(agentPayment.toObject()),
        message:
          'Operación completada. La comisión del Agente quedó pendiente en wallet hasta el hold.',
      };
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
          holdDays: AGENT_COMMISSION_HOLD_DAYS,
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
      description: `Comisión acreditada · ${tx.code}`,
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
      description: `Comisión ConfiApp (30% de la intermediación) · ${tx.code}`,
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
        ? 'Entrega confirmada — operación cerrada (confirmación automática tras 72h)'
        : 'Entrega confirmada — operación cerrada',
    });
    await tx.save();

    await persistLog({
      source: 'release',
      event: 'escrow.released',
      message: 'Comisión liquidada (cierre de operación)',
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

    const isAgentFeeOnly =
      resolvePaymentFundingMode(tx.fundingMode) === FundingMode.AGENT_FEE_ONLY;

    const partyBody = (uid: string): string => {
      if (uid === parties.agentId) {
        return autoReleased
          ? `Se acreditó tu comisión de intermediación en ${tx.code} (cierre automático). Queda pendiente ${AGENT_COMMISSION_HOLD_DAYS} días y luego disponible para la liquidación mensual.`
          : `Se acreditó tu comisión de intermediación en ${tx.code}. Queda pendiente ${AGENT_COMMISSION_HOLD_DAYS} días y luego disponible para la liquidación mensual.`;
      }
      if (isAgentFeeOnly) {
        return autoReleased
          ? `La operación ${tx.code} se completó automáticamente. La comisión del Agente quedó acreditada en wallet (pendiente).`
          : `La operación ${tx.code} se completó. La comisión del Agente quedó acreditada en wallet (pendiente).`;
      }
      if (uid === parties.sellerId) {
        return autoReleased
          ? `La operación ${tx.code} se completó automáticamente tras 72h.`
          : `La operación ${tx.code} se completó.`;
      }
      return autoReleased
        ? `La operación ${tx.code} se completó automáticamente tras 72h.`
        : `La operación ${tx.code} se completó.`;
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
          title: `Operación cerrada · ${tx.code}`,
          body: autoReleased
            ? `Cierre automático tras 72h: comisión del Agente pendiente ${AGENT_COMMISSION_HOLD_DAYS} días (luego liquidación mensual).`
            : `Comisión del Agente pendiente ${AGENT_COMMISSION_HOLD_DAYS} días (luego liquidación mensual).`,
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
   * Comprador rechaza el producto tras verificación del Agente:
   * cancela la operación **sin reembolso MP** y acredita la comisión del Agente
   * (trabajo ya realizado: viaje / verificación).
   */
  async settleAgentFeeAndCancelOnBuyerReject(userId: string, code: string, note?: string) {
    const tx = await this.loadTxForParticipant(userId, code);
    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        `Solo se puede cancelar con Agente contratado o en curso (actual: ${tx.status})`,
      );
    }
    assertNotPastDeadline(tx);
    assertTransition(tx.status, TransactionStatus.CANCELLED);

    if (resolvePaymentFundingMode(tx.fundingMode) !== FundingMode.AGENT_FEE_ONLY) {
      throw new ValidationError(
        'Este cierre sin reembolso aplica al modo de contratación del Agente.',
      );
    }

    const parties = resolveParties(tx);
    if (!parties.agentId) {
      throw new ValidationError('No hay Agente asignado para acreditar la comisión');
    }

    const hold = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_HOLD,
      status: PaymentStatus.CAPTURED,
      deletedAt: null,
    }).exec();
    if (!hold) {
      throw new ValidationError('No hay contratación del Agente capturada para liquidar');
    }

    const alreadyReleased = await PaymentModel.findOne({
      transaction: tx._id,
      type: PaymentType.ESCROW_RELEASE,
      status: { $in: [PaymentStatus.RELEASED, PaymentStatus.CAPTURED] },
      deletedAt: null,
    }).lean();
    if (alreadyReleased) {
      throw new ValidationError('La comisión del Agente ya fue liquidada');
    }

    const meta = (hold.metadata ?? {}) as Record<string, unknown>;
    const buyerPays = hold.amountCents || AGENT_FEE_ONLY_UYU_CENTS;
    const platformFee =
      typeof meta.platformFeeCents === 'number'
        ? Math.max(0, meta.platformFeeCents)
        : Math.floor((buyerPays * env.PAYMENTS_PLATFORM_FEE_BPS) / 10_000);
    const agentFee =
      typeof meta.agentFeeCents === 'number'
        ? Math.max(0, meta.agentFeeCents)
        : Math.max(0, buyerPays - platformFee);
    const currency = hold.currency || 'UYU';
    const now = new Date();
    const provider = hold.provider;
    const split = {
      fundingMode: FundingMode.AGENT_FEE_ONLY,
      productCents: 0,
      commissionCents: buyerPays,
      buyerPaysCents: buyerPays,
      sellerNetCents: 0,
      platformFeeCents: platformFee,
      agentFeeCents: agentFee,
      currency,
      feePayer: 'BUYER' as const,
    };

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
      metadata: {
        split,
        bps: env.PAYMENTS_PLATFORM_FEE_BPS,
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        reason: 'buyer_rejected_product',
      },
    });

    const agentPayment = await PaymentModel.create({
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
        holdDays: AGENT_COMMISSION_HOLD_DAYS,
        accounting: 'PENDING_COMMISSION',
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        reason: 'buyer_rejected_product',
      },
    });

    await agentCommissionService.recordOnCompleted({
      transactionId: String(tx._id),
      transactionCode: tx.code,
      agentId: parties.agentId,
      commissionCents: buyerPays,
      agentShareCents: agentFee,
      platformShareCents: platformFee,
      currency,
      completedAt: now,
      paymentId: String(agentPayment._id),
      actorId: userId,
      metadata: { split, reason: 'buyer_rejected_product' },
    });

    const release = await PaymentModel.create({
      transaction: tx._id,
      payer: hold.payer,
      payee: new Types.ObjectId(parties.agentId),
      type: PaymentType.ESCROW_RELEASE,
      status: PaymentStatus.RELEASED,
      provider,
      amountCents: Math.max(1, agentFee || 1),
      currency,
      idempotencyKey: `release:${String(tx._id)}`,
      releasedAt: now,
      capturedAt: now,
      metadata: {
        split,
        fromHoldId: String(hold._id),
        fundingMode: FundingMode.AGENT_FEE_ONLY,
        reason: 'buyer_rejected_product',
      },
    });

    hold.status = PaymentStatus.RELEASED;
    hold.releasedAt = now;
    hold.metadata = {
      ...(hold.metadata ?? {}),
      phase: 'released_on_buyer_reject',
      split,
      noRefund: true,
    };
    await hold.save();

    await financialAudit.record({
      action: 'ESCROW_RELEASED',
      idempotencyKey: `fa:release-reject:${String(tx._id)}`,
      operationId: String(tx._id),
      paymentId: String(agentPayment._id),
      agentId: parties.agentId,
      actorId: userId,
      amountCents: agentFee,
      currency,
      newStatus: TransactionStatus.CANCELLED,
      metadata: { reason: 'buyer_rejected_product', noRefund: true },
    });

    tx.status = TransactionStatus.CANCELLED;
    tx.cancelledAt = now;
    tx.statusHistory.push({
      status: TransactionStatus.CANCELLED,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note:
        note ??
        'Comprador rechazó el producto. Contratación del Agente no reembolsada (trabajo realizado).',
    });
    await tx.save();

    await persistLog({
      source: 'system',
      event: 'escrow.settled_on_buyer_reject',
      message: 'Rechazo comprador: comisión Agente acreditada, sin reembolso MP',
      transactionId: String(tx._id),
      paymentId: String(release._id),
      payload: {
        code: tx.code,
        cancelledBy: userId,
        agentFeeCents: agentFee,
        platformFeeCents: platformFee,
        noRefund: true,
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
        phase: 'agent_fee_settled_on_buyer_reject',
        code: tx.code,
        agentFeeCents: agentFee,
        platformFeeCents: platformFee,
        feePaymentId: String(fee._id),
        agentPaymentId: String(agentPayment._id),
        noRefund: true,
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
        noRefund: true,
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
              ? `Rechazaste el producto de ${tx.code}. La contratación del Agente no se reembolsa: el Agente ya realizó el trabajo.`
              : uid === parties.sellerId
                ? `El comprador rechazó el producto en ${tx.code}. La operación se canceló.`
                : `El comprador rechazó el producto en ${tx.code}. Tu comisión se acredita; coordiná la devolución al vendedor si corresponde.`,
          data: {
            href,
            code: tx.code,
            status: TransactionStatus.CANCELLED,
            step: 'buyer_rejected_product',
            noRefund: true,
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
      agentPayout: toPaymentDto(agentPayment.toObject()),
      platformFee: toPaymentDto(fee.toObject()),
    };
  }

  /**
   * Bloqueado: los reembolsos live solo se ejecutan desde resolución admin de disputa
   * (`COMPLETE_WITH_REFUND`).
   */
  async refundEscrowAndCancel(_userId: string, _code: string, _note?: string) {
    throw new ValidationError(
      'Los reembolsos solo los ejecuta un administrador al resolver una disputa.',
    );
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
