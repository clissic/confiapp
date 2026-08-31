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
  TransactionModel,
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

    const availableCents = wallet.availableCents ?? 0;
    /** Comisiones de agente maduras viven en availableCents; no son retirábles self-service. */
    const agentLockedInAvailableCents = agentCommissions
      ? (agentCommissions.availableCents ?? 0) + (agentCommissions.reservedCents ?? 0)
      : 0;
    const salesWithdrawableCents = Math.max(0, availableCents - agentLockedInAvailableCents);

    return {
      status: wallet.status,
      /** Ledger retenido siempre en UYU (Mercado Pago). La UI convierte con preferencia. */
      currency: 'UYU',
      saldoCents: availableCents,
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
      /** Fondos de ventas (vendedor) retirábles self-service; excluye comisiones de agente. */
      salesWithdrawableCents,
      /** Self-service habilitado para todos: agentes solo sobre ventas. */
      agentSelfServiceWithdrawalsEnabled: true,
    };
  }

  async listMovements(
    userId: string,
    opts: {
      limit?: number;
      page?: number;
      type?: string;
      direction?: string;
      transactionCode?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 10, 200);
    const page = Math.max(1, opts.page ?? 1);
    const skip = (page - 1) * limit;

    let transactionId: Types.ObjectId | undefined;
    if (opts.transactionCode?.trim()) {
      const tx = await TransactionModel.findOne({
        code: opts.transactionCode.trim().toUpperCase(),
        deletedAt: null,
      })
        .select('_id')
        .lean()
        .exec();
      if (!tx) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          source: 'ledger' as const,
        };
      }
      transactionId = tx._id as Types.ObjectId;
    }

    const dateFilter: Record<string, Date> = {};
    if (opts.from) {
      const from = new Date(opts.from);
      if (!Number.isNaN(from.getTime())) dateFilter.$gte = from;
    }
    if (opts.to) {
      const to = new Date(opts.to);
      if (!Number.isNaN(to.getTime())) dateFilter.$lte = to;
    }

    const ledgerFilter: Record<string, unknown> = { user: userId, deletedAt: null };
    if (opts.type) ledgerFilter.type = opts.type;
    if (opts.direction) ledgerFilter.direction = opts.direction;
    if (transactionId) ledgerFilter.transaction = transactionId;
    if (Object.keys(dateFilter).length) ledgerFilter.createdAt = dateFilter;

    const hasAnyLedger = await WalletMovementModel.exists({
      user: userId,
      deletedAt: null,
    });

    if (hasAnyLedger) {
      const [total, rows] = await Promise.all([
        WalletMovementModel.countDocuments(ledgerFilter).exec(),
        WalletMovementModel.find(ledgerFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      const codeByTxId = await this.loadTransactionCodes(
        rows.map((m) => (m.transaction ? String(m.transaction) : null)),
      );

      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
      return {
        items: rows.map((m) => {
          const txId = m.transaction ? String(m.transaction) : undefined;
          return {
            id: String(m._id),
            type: m.type,
            direction: m.direction,
            amountCents: m.amountCents,
            currency: m.currency,
            description: m.description,
            balanceAfter: m.balanceAfter,
            paymentId: m.payment ? String(m.payment) : undefined,
            transactionId: txId,
            transactionCode: txId ? codeByTxId.get(txId) : undefined,
            withdrawalId: m.withdrawal ? String(m.withdrawal) : undefined,
            createdAt: m.createdAt.toISOString(),
            source: 'ledger' as const,
          };
        }),
        total,
        page,
        limit,
        totalPages,
        source: 'ledger' as const,
      };
    }

    // Fallback legado: pagos sin ledger.
    const paymentFilter: Record<string, unknown> = {
      deletedAt: null,
      $or: [{ payer: userId }, { payee: userId }],
    };
    if (opts.type) paymentFilter.type = opts.type;
    if (transactionId) paymentFilter.transaction = transactionId;
    if (Object.keys(dateFilter).length) paymentFilter.createdAt = dateFilter;

    const payments = await PaymentModel.find(paymentFilter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    let mapped = payments.map((p) => {
      const direction =
        p.type === PaymentType.PLATFORM_FEE || String(p.payer) === userId
          ? WalletMovementDirection.DEBIT
          : WalletMovementDirection.CREDIT;
      return {
        id: String(p._id),
        type: String(p.type),
        direction,
        amountCents: p.amountCents,
        currency: p.currency,
        description: `Pago ${p.type} · ${p.status}`,
        paymentId: String(p._id),
        transactionId: String(p.transaction),
        createdAt: p.createdAt.toISOString(),
        source: 'payment' as const,
      };
    });

    if (opts.direction) {
      mapped = mapped.filter((m) => m.direction === opts.direction);
    }

    const total = mapped.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const pageItems = mapped.slice(skip, skip + limit);
    const codeByTxId = await this.loadTransactionCodes(
      pageItems.map((m) => m.transactionId ?? null),
    );

    return {
      items: pageItems.map((m) => ({
        ...m,
        transactionCode: m.transactionId
          ? codeByTxId.get(m.transactionId)
          : undefined,
      })),
      total,
      page,
      limit,
      totalPages,
      source: 'payments' as const,
    };
  }

  private async loadTransactionCodes(
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const map = new Map<string, string>();
    if (!unique.length) return map;

    const txs = await TransactionModel.find({
      _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
      deletedAt: null,
    })
      .select('_id code')
      .lean()
      .exec();

    for (const tx of txs) {
      map.set(String(tx._id), tx.code);
    }
    return map;
  }

  async listCommissions(
    userId: string,
    opts: {
      limit?: number;
      page?: number;
      type?: string;
      transactionCode?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 10, 100);
    const page = Math.max(1, opts.page ?? 1);
    const skip = (page - 1) * limit;

    let transactionId: Types.ObjectId | undefined;
    if (opts.transactionCode?.trim()) {
      const tx = await TransactionModel.findOne({
        code: opts.transactionCode.trim().toUpperCase(),
        deletedAt: null,
      })
        .select('_id')
        .lean()
        .exec();
      if (!tx) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      transactionId = tx._id as Types.ObjectId;
    }

    const dateFilter: Record<string, Date> = {};
    if (opts.from) {
      const from = new Date(opts.from);
      if (!Number.isNaN(from.getTime())) dateFilter.$gte = from;
    }
    if (opts.to) {
      const to = new Date(opts.to);
      if (!Number.isNaN(to.getTime())) dateFilter.$lte = to;
    }

    const filter: Record<string, unknown> = {
      deletedAt: null,
      type: opts.type
        ? opts.type
        : { $in: [PaymentType.PLATFORM_FEE, PaymentType.AGENT_PAYOUT] },
      $or: [{ payer: userId }, { payee: userId }],
    };
    if (transactionId) filter.transaction = transactionId;
    if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;

    const [total, fees] = await Promise.all([
      PaymentModel.countDocuments(filter).exec(),
      PaymentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const codeByTxId = await this.loadTransactionCodes(
      fees.map((p) => (p.transaction ? String(p.transaction) : null)),
    );
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: fees.map((p) => {
        const txId = String(p.transaction);
        return {
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
          transactionId: txId,
          transactionCode: codeByTxId.get(txId),
          createdAt: p.createdAt.toISOString(),
          label:
            p.type === PaymentType.AGENT_PAYOUT && String(p.payee) === userId
              ? 'Comisión de agente recibida'
              : p.type === PaymentType.PLATFORM_FEE
                ? 'Comisión de plataforma'
                : String(p.type),
        };
      }),
      total,
      page,
      limit,
      totalPages,
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

    const amount = Math.trunc(input.amountCents);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_CENTS) {
      throw new ValidationError(
        `El retiro mínimo es ${MIN_WITHDRAWAL_CENTS / 100} UYU`,
      );
    }

    const isAgent =
      user.role === PlatformRole.AGENT ||
      (user.roles ?? []).includes(PlatformRole.AGENT);

    const availableCents = user.wallet.availableCents ?? 0;
    let maxWithdrawable = availableCents;

    if (isAgent) {
      const agentBalances = await agentCommissionService.getAgentBalances(userId);
      const agentLocked =
        (agentBalances.availableCents ?? 0) + (agentBalances.reservedCents ?? 0);
      maxWithdrawable = Math.max(0, availableCents - agentLocked);
    }

    if (amount > maxWithdrawable) {
      if (isAgent && maxWithdrawable < availableCents) {
        throw new ValidationError(
          `Solo podés retirar fondos de ventas (disponible: ${(maxWithdrawable / 100).toFixed(2)} UYU). Las comisiones de agente se liquidan por transferencia del 1 al 10 de cada mes.`,
        );
      }
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
      description: `Solicitud de retiro${input.destinationHint ? ` → ${input.destinationHint}` : ''}${isAgent ? ' (ventas)' : ''}`,
      withdrawalId: String(withdrawal._id),
      balanceAfter: snapshotFromUser(user),
      metadata: isAgent ? { source: 'sales_withdrawable' } : undefined,
    });

    logger.info('wallet withdrawal requested', {
      userId,
      amountCents: amount,
      withdrawalId: String(withdrawal._id),
      isAgent,
      maxWithdrawable,
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
        isAgent,
        source: isAgent ? 'sales_withdrawable' : 'available',
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
    const { items } = await this.listMovements(userId, { limit: 500, page: 1 });
    const header = [
      'fecha',
      'tipo',
      'direccion',
      'monto_centavos',
      'moneda',
      'descripcion',
      'payment_id',
      'transaction_id',
      'transaction_code',
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
        'transactionCode' in m && m.transactionCode ? m.transactionCode : '',
        'withdrawalId' in m && m.withdrawalId ? m.withdrawalId : '',
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }
}
