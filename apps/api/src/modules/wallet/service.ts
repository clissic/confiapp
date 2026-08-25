import {
  PaymentType,
  PlatformRole,
  WalletMovementDirection,
  WalletMovementType,
  WalletStatus,
  WithdrawalStatus,
  type WalletBalanceSnapshot,
} from '@confiapp/database';
import { Types } from 'mongoose';

import {
  PaymentModel,
  UserModel,
  WalletMovementModel,
  WithdrawalModel,
} from '../../database/models';
import { defaultCurrency } from '../../shared/config/currency';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';
import { AuditAction, AuditOutcome, auditService } from '../audit';
import { agentCommissionService } from '../finance/commission.service';

const MIN_WITHDRAWAL_CENTS = 1000;

function snapshotFromUser(user: {
  wallet?: {
    availableCents?: number;
    pendingCents?: number;
    heldCents?: number;
  };
}): WalletBalanceSnapshot {
  return {
    availableCents: user.wallet?.availableCents ?? 0,
    pendingCents: user.wallet?.pendingCents ?? 0,
    heldCents: user.wallet?.heldCents ?? 0,
  };
}

export class WalletLedgerService {
  async record(input: {
    userId: string;
    type: WalletMovementType;
    direction: WalletMovementDirection;
    amountCents: number;
    currency: string;
    description: string;
    paymentId?: string;
    transactionId?: string;
    withdrawalId?: string;
    balanceAfter?: WalletBalanceSnapshot;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await WalletMovementModel.create({
        user: new Types.ObjectId(input.userId),
        type: input.type,
        direction: input.direction,
        amountCents: input.amountCents,
        currency: input.currency.toUpperCase(),
        description: input.description,
        balanceAfter: input.balanceAfter,
        payment: input.paymentId ? new Types.ObjectId(input.paymentId) : undefined,
        transaction: input.transactionId
          ? new Types.ObjectId(input.transactionId)
          : undefined,
        withdrawal: input.withdrawalId
          ? new Types.ObjectId(input.withdrawalId)
          : undefined,
        metadata: input.metadata,
      });
    } catch (error) {
      logger.error('wallet movement persist failed', { error, input });
    }
  }
}

export const walletLedger = new WalletLedgerService();

export class WalletService {
  async getSummary(userId: string) {
    const user = await UserModel.findById(userId)
      .select('wallet roles role')
      .lean()
      .exec();
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const wallet = user.wallet ?? {
      status: WalletStatus.ACTIVE,
      currency: defaultCurrency(),
      availableCents: 0,
      pendingCents: 0,
      heldCents: 0,
      lifetimeEarnedCents: 0,
      lifetimeSpentCents: 0,
    };

    const [movementsCount, pendingWithdrawals, commissionsAgg] = await Promise.all([
      WalletMovementModel.countDocuments({ user: userId, deletedAt: null }),
      WithdrawalModel.countDocuments({
        user: userId,
        status: { $in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
        deletedAt: null,
      }),
      PaymentModel.aggregate<{ total: number }>([
        {
          $match: {
            deletedAt: null,
            type: { $in: [PaymentType.PLATFORM_FEE, PaymentType.AGENT_PAYOUT] },
            $or: [{ payer: new Types.ObjectId(userId) }, { payee: new Types.ObjectId(userId) }],
          },
        },
        { $group: { _id: null, total: { $sum: '$amountCents' } } },
      ]),
    ]);

    const isAgent =
      user.role === PlatformRole.AGENT ||
      (user.roles ?? []).includes(PlatformRole.AGENT);
    const agentCommissions = isAgent
      ? await agentCommissionService.getAgentBalances(userId)
      : null;

    return {
      status: wallet.status,
      /** Ledger retenido siempre en UYU (Mercado Pago). La UI convierte con preferencia. */
      currency: 'UYU',
      saldoCents: wallet.availableCents ?? 0,
      pendienteCents: wallet.pendingCents ?? 0,
      retenidoCents: wallet.heldCents ?? 0,
      lifetimeEarnedCents: wallet.lifetimeEarnedCents ?? 0,
      lifetimeSpentCents: wallet.lifetimeSpentCents ?? 0,
      lastMovementAt:
        wallet.lastMovementAt instanceof Date
          ? wallet.lastMovementAt.toISOString()
          : undefined,
      movementsCount,
      pendingWithdrawalsCount: pendingWithdrawals,
      commissionsTotalCents: commissionsAgg[0]?.total ?? 0,
      agentCommissions,
      agentSelfServiceWithdrawalsEnabled: !isAgent,
    };
  }

  async listMovements(userId: string, opts: { limit?: number; type?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const filter: Record<string, unknown> = { user: userId, deletedAt: null };
    if (opts.type) filter.type = opts.type;

    const rows = await WalletMovementModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    if (rows.length === 0) {
      const payments = await PaymentModel.find({
        deletedAt: null,
        $or: [{ payer: userId }, { payee: userId }],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec();

      return {
        items: payments.map((p) => ({
          id: String(p._id),
          type: p.type,
          direction:
            p.type === PaymentType.PLATFORM_FEE || String(p.payer) === userId
              ? WalletMovementDirection.DEBIT
              : WalletMovementDirection.CREDIT,
          amountCents: p.amountCents,
          currency: p.currency,
          description: `Pago ${p.type} · ${p.status}`,
          paymentId: String(p._id),
          transactionId: String(p.transaction),
          createdAt: p.createdAt.toISOString(),
          source: 'payment' as const,
        })),
        source: 'payments' as const,
      };
    }

    return {
      items: rows.map((m) => ({
        id: String(m._id),
        type: m.type,
        direction: m.direction,
        amountCents: m.amountCents,
        currency: m.currency,
        description: m.description,
        balanceAfter: m.balanceAfter,
        paymentId: m.payment ? String(m.payment) : undefined,
        transactionId: m.transaction ? String(m.transaction) : undefined,
        withdrawalId: m.withdrawal ? String(m.withdrawal) : undefined,
        createdAt: m.createdAt.toISOString(),
        source: 'ledger' as const,
      })),
      source: 'ledger' as const,
    };
  }

  async listCommissions(userId: string, limit = 50) {
    const fees = await PaymentModel.find({
      deletedAt: null,
      type: { $in: [PaymentType.PLATFORM_FEE, PaymentType.AGENT_PAYOUT] },
      $or: [{ payer: userId }, { payee: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100))
      .lean()
      .exec();

    return {
      items: fees.map((p) => ({
        id: String(p._id),
        type: p.type,
        role:
          p.type === PaymentType.AGENT_PAYOUT && String(p.payee) === userId
            ? ('earned' as const)
            : p.type === PaymentType.PLATFORM_FEE
              ? ('platform_fee' as const)
              : ('other' as const),
        amountCents: p.amountCents,
        currency: p.currency,
        status: p.status,
        transactionId: String(p.transaction),
        createdAt: p.createdAt.toISOString(),
        label:
          p.type === PaymentType.AGENT_PAYOUT && String(p.payee) === userId
            ? 'Comisión de agente recibida'
            : p.type === PaymentType.PLATFORM_FEE
              ? 'Comisión de plataforma (20%)'
              : p.type,
      })),
    };
  }

  async listWithdrawals(userId: string) {
    const rows = await WithdrawalModel.find({ user: userId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
    return {
      items: rows.map((w) => ({
        id: String(w._id),
        amountCents: w.amountCents,
        currency: w.currency,
        status: w.status,
        destinationHint: w.destinationHint,
        requestedAt: w.requestedAt.toISOString(),
        processedAt: w.processedAt?.toISOString(),
        failureReason: w.failureReason,
      })),
    };
  }

  async requestWithdrawal(
    userId: string,
    input: { amountCents: number; destinationHint?: string },
  ) {
    const user = await UserModel.findById(userId).exec();
    if (!user) throw new NotFoundError('Usuario no encontrado');
    if (!user.wallet) throw new ValidationError('Wallet no inicializada');
    if (user.wallet.status !== WalletStatus.ACTIVE) {
      throw new ForbiddenError(`Wallet ${user.wallet.status}: no admite retiros`);
    }

    const isAgent =
      user.role === PlatformRole.AGENT ||
      (user.roles ?? []).includes(PlatformRole.AGENT);
    if (isAgent) {
      throw new ValidationError(
        'Las comisiones de agente se liquidan por transferencia manual del 1 al 10 de cada mes. No hay retiro self-service.',
      );
    }

    const amount = Math.trunc(input.amountCents);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_CENTS) {
      throw new ValidationError(
        `El retiro mínimo es ${MIN_WITHDRAWAL_CENTS / 100} UYU`,
      );
    }
    if (amount > (user.wallet.availableCents ?? 0)) {
      throw new ValidationError('Saldo disponible insuficiente');
    }

    const currency = 'UYU';
    user.wallet.currency = currency;
    const now = new Date();

    user.wallet.availableCents -= amount;
    user.wallet.pendingCents = (user.wallet.pendingCents ?? 0) + amount;
    user.wallet.lastMovementAt = now;
    await user.save();

    const withdrawal = await WithdrawalModel.create({
      user: user._id,
      amountCents: amount,
      currency,
      status: WithdrawalStatus.PENDING,
      destinationHint: input.destinationHint?.trim().slice(0, 120),
      requestedAt: now,
    });

    await walletLedger.record({
      userId,
      type: WalletMovementType.WITHDRAWAL_REQUEST,
      direction: WalletMovementDirection.DEBIT,
      amountCents: amount,
      currency,
      description: `Solicitud de retiro${input.destinationHint ? ` → ${input.destinationHint}` : ''}`,
      withdrawalId: String(withdrawal._id),
      balanceAfter: snapshotFromUser(user),
    });

    logger.info('wallet withdrawal requested', {
      userId,
      amountCents: amount,
      withdrawalId: String(withdrawal._id),
    });

    auditService.track({
      actor: userId,
      action: AuditAction.WALLET_WITHDRAWAL,
      entityType: 'Withdrawal',
      entityId: String(withdrawal._id),
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        amountCents: amount,
        currency,
        status: WithdrawalStatus.PENDING,
        destinationHint: withdrawal.destinationHint,
      },
    });

    return {
      withdrawal: {
        id: String(withdrawal._id),
        amountCents: amount,
        currency,
        status: withdrawal.status,
        destinationHint: withdrawal.destinationHint,
        requestedAt: now.toISOString(),
      },
      wallet: snapshotFromUser(user),
    };
  }

  async completeWithdrawal(userId: string, withdrawalId: string) {
    const withdrawal = await WithdrawalModel.findOne({
      _id: withdrawalId,
      user: userId,
      deletedAt: null,
    }).exec();
    if (!withdrawal) throw new NotFoundError('Retiro no encontrado');
    if (
      withdrawal.status !== WithdrawalStatus.PENDING &&
      withdrawal.status !== WithdrawalStatus.PROCESSING
    ) {
      throw new ValidationError(`El retiro ya está ${withdrawal.status}`);
    }

    const user = await UserModel.findById(userId).exec();
    if (!user?.wallet) throw new NotFoundError('Usuario no encontrado');

    const amount = withdrawal.amountCents;
    if ((user.wallet.pendingCents ?? 0) < amount) {
      throw new ValidationError('Pendiente insuficiente para completar el retiro');
    }

    const now = new Date();
    user.wallet.pendingCents -= amount;
    user.wallet.lifetimeSpentCents = (user.wallet.lifetimeSpentCents ?? 0) + amount;
    user.wallet.lastMovementAt = now;
    await user.save();

    withdrawal.status = WithdrawalStatus.COMPLETED;
    withdrawal.processedAt = now;
    await withdrawal.save();

    await walletLedger.record({
      userId,
      type: WalletMovementType.WITHDRAWAL_COMPLETED,
      direction: WalletMovementDirection.DEBIT,
      amountCents: amount,
      currency: withdrawal.currency,
      description: 'Retiro completado',
      withdrawalId: String(withdrawal._id),
      balanceAfter: snapshotFromUser(user),
    });

    auditService.track({
      actor: userId,
      action: AuditAction.WALLET_WITHDRAWAL,
      entityType: 'Withdrawal',
      entityId: String(withdrawal._id),
      outcome: AuditOutcome.SUCCESS,
      metadata: { status: WithdrawalStatus.COMPLETED, amountCents: amount },
    });

    return {
      withdrawal: {
        id: String(withdrawal._id),
        status: withdrawal.status,
        processedAt: now.toISOString(),
      },
      wallet: snapshotFromUser(user),
    };
  }

  async exportHistoryCsv(userId: string): Promise<string> {
    const { items } = await this.listMovements(userId, { limit: 500 });
    const header = [
      'fecha',
      'tipo',
      'direccion',
      'monto_centavos',
      'moneda',
      'descripcion',
      'payment_id',
      'transaction_id',
      'withdrawal_id',
    ].join(',');

    const lines = items.map((m) =>
      [
        m.createdAt,
        m.type,
        m.direction,
        m.amountCents,
        m.currency,
        `"${(m.description ?? '').replace(/"/g, '""')}"`,
        m.paymentId ?? '',
        m.transactionId ?? '',
        'withdrawalId' in m && m.withdrawalId ? m.withdrawalId : '',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }
}
