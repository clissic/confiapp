import {
  AgentCommissionModel,
  AgentCommissionStatus,
  PaymentType,
  WalletMovementDirection,
  WalletMovementType,
  type IAgentCommission,
} from '@confiapp/database';
import { addCommissionHoldDays } from '@confiapp/shared';
import { Types } from 'mongoose';

import { UserModel } from '../../database/models';
import { ValidationError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';
import { walletLedger } from '../wallet/service';

import { financialAudit } from './financial-audit.service';

export type RecordAgentCommissionInput = {
  transactionId: string;
  transactionCode: string;
  agentId: string;
  commissionCents: number;
  agentShareCents: number;
  platformShareCents: number;
  currency: string;
  completedAt: Date;
  paymentId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

function toDto(doc: IAgentCommission & { _id?: Types.ObjectId }) {
  return {
    id: String(doc._id),
    transactionId: String(doc.transaction),
    agentId: String(doc.agent),
    paymentId: doc.payment ? String(doc.payment) : undefined,
    commissionCents: doc.commissionCents,
    agentShareCents: doc.agentShareCents,
    platformShareCents: doc.platformShareCents,
    currency: doc.currency,
    status: doc.status,
    completedAt: doc.completedAt.toISOString(),
    availableAt: doc.availableAt.toISOString(),
    disputeBlocked: doc.disputeBlocked,
    payoutId: doc.payout ? String(doc.payout) : undefined,
    payoutBatchId: doc.payoutBatch ? String(doc.payoutBatch) : undefined,
    idempotencyKey: doc.idempotencyKey,
  };
}

/**
 * Comisiones de agente: PENDING al COMPLETED, AVAILABLE tras 21 días.
 */
export class AgentCommissionService {
  /**
   * Crea comisión PENDING + ledger COMMISSION_EARNED.
   * Idempotente por transaction+agent / idempotencyKey.
   * NO incrementa wallet.availableCents.
   */
  async recordOnCompleted(
    input: RecordAgentCommissionInput,
  ): Promise<ReturnType<typeof toDto> | null> {
    if (input.agentShareCents <= 0) return null;

    const idempotencyKey = `commission:${input.transactionId}:${input.agentId}`;
    const availableAt = addCommissionHoldDays(input.completedAt);

    try {
      const created = await AgentCommissionModel.create({
        transaction: new Types.ObjectId(input.transactionId),
        agent: new Types.ObjectId(input.agentId),
        payment: input.paymentId ? new Types.ObjectId(input.paymentId) : undefined,
        commissionCents: input.commissionCents,
        agentShareCents: input.agentShareCents,
        platformShareCents: input.platformShareCents,
        currency: input.currency.toUpperCase(),
        status: AgentCommissionStatus.PENDING,
        completedAt: input.completedAt,
        availableAt,
        disputeBlocked: false,
        idempotencyKey,
        metadata: input.metadata,
      });

      await UserModel.updateOne(
        { _id: input.agentId },
        {
          $inc: {
            'wallet.pendingCents': input.agentShareCents,
            'wallet.lifetimeEarnedCents': input.agentShareCents,
          },
          $set: { 'wallet.lastMovementAt': input.completedAt },
        },
      ).exec();

      const agentAfter = await UserModel.findById(input.agentId).select('wallet').lean();
      await walletLedger.record({
        userId: input.agentId,
        type: WalletMovementType.COMMISSION_EARNED,
        direction: WalletMovementDirection.CREDIT,
        amountCents: input.agentShareCents,
        currency: input.currency,
        description: `Comisión ganada (pendiente 21d) · ${input.transactionCode}`,
        paymentId: input.paymentId,
        transactionId: input.transactionId,
        balanceAfter: agentAfter
          ? {
              availableCents: agentAfter.wallet?.availableCents ?? 0,
              pendingCents: agentAfter.wallet?.pendingCents ?? 0,
              heldCents: agentAfter.wallet?.heldCents ?? 0,
            }
          : undefined,
        metadata: {
          commissionId: String(created._id),
          availableAt: availableAt.toISOString(),
        },
      });

      await financialAudit.record({
        action: 'COMMISSION_EARNED',
        idempotencyKey: `fa:${idempotencyKey}`,
        operationId: input.transactionId,
        paymentId: input.paymentId,
        commissionId: String(created._id),
        agentId: input.agentId,
        actorId: input.actorId,
        actorRole: 'SYSTEM',
        amountCents: input.agentShareCents,
        currency: input.currency,
        previousStatus: undefined,
        newStatus: AgentCommissionStatus.PENDING,
        metadata: { availableAt: availableAt.toISOString() },
      });

      return toDto(created.toObject());
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: number }).code
          : undefined;
      if (code === 11000) {
        const existing = await AgentCommissionModel.findOne({
          idempotencyKey,
          deletedAt: null,
        }).lean();
        logger.info('agent commission already recorded', { idempotencyKey });
        return existing ? toDto(existing) : null;
      }
      throw error;
    }
  }

  /**
   * Job: PENDING → AVAILABLE cuando availableAt <= now y no bloqueada.
   */
  async releaseDue(now: Date = new Date()): Promise<{ released: number }> {
    const due = await AgentCommissionModel.find({
      status: AgentCommissionStatus.PENDING,
      disputeBlocked: false,
      availableAt: { $lte: now },
      deletedAt: null,
    })
      .limit(200)
      .exec();

    let released = 0;
    for (const commission of due) {
      const updated = await AgentCommissionModel.findOneAndUpdate(
        {
          _id: commission._id,
          status: AgentCommissionStatus.PENDING,
          disputeBlocked: false,
          deletedAt: null,
        },
        { $set: { status: AgentCommissionStatus.AVAILABLE } },
        { new: true },
      ).exec();
      if (!updated) continue;

      const agentId = String(updated.agent);
      const amount = updated.agentShareCents;

      await UserModel.updateOne(
        { _id: agentId },
        {
          $inc: {
            'wallet.pendingCents': -amount,
            'wallet.availableCents': amount,
          },
          $set: { 'wallet.lastMovementAt': now },
        },
      ).exec();

      const agentAfter = await UserModel.findById(agentId).select('wallet').lean();
      await walletLedger.record({
        userId: agentId,
        type: WalletMovementType.COMMISSION_AVAILABLE,
        direction: WalletMovementDirection.CREDIT,
        amountCents: amount,
        currency: updated.currency,
        description: 'Comisión disponible para liquidación',
        transactionId: String(updated.transaction),
        balanceAfter: agentAfter
          ? {
              availableCents: agentAfter.wallet?.availableCents ?? 0,
              pendingCents: agentAfter.wallet?.pendingCents ?? 0,
              heldCents: agentAfter.wallet?.heldCents ?? 0,
            }
          : undefined,
        metadata: { commissionId: String(updated._id) },
      });

      await financialAudit.record({
        action: 'COMMISSION_AVAILABLE',
        idempotencyKey: `fa:available:${String(updated._id)}`,
        operationId: String(updated.transaction),
        commissionId: String(updated._id),
        agentId,
        actorRole: 'SYSTEM',
        amountCents: amount,
        currency: updated.currency,
        previousStatus: AgentCommissionStatus.PENDING,
        newStatus: AgentCommissionStatus.AVAILABLE,
      });

      released += 1;
    }

    return { released };
  }

  async setDisputeBlocked(
    transactionId: string,
    blocked: boolean,
  ): Promise<number> {
    const result = await AgentCommissionModel.updateMany(
      {
        transaction: new Types.ObjectId(transactionId),
        status: {
          $in: [AgentCommissionStatus.PENDING, AgentCommissionStatus.AVAILABLE],
        },
        deletedAt: null,
      },
      {
        $set: {
          disputeBlocked: blocked,
          ...(blocked ? { status: AgentCommissionStatus.BLOCKED } : {}),
        },
      },
    ).exec();

    // Si se desbloquea, volver PENDING si availableAt futuro, AVAILABLE si ya venció.
    if (!blocked) {
      const now = new Date();
      await AgentCommissionModel.updateMany(
        {
          transaction: new Types.ObjectId(transactionId),
          status: AgentCommissionStatus.BLOCKED,
          deletedAt: null,
          availableAt: { $gt: now },
        },
        { $set: { status: AgentCommissionStatus.PENDING, disputeBlocked: false } },
      ).exec();
      await AgentCommissionModel.updateMany(
        {
          transaction: new Types.ObjectId(transactionId),
          status: AgentCommissionStatus.BLOCKED,
          deletedAt: null,
          availableAt: { $lte: now },
        },
        { $set: { status: AgentCommissionStatus.AVAILABLE, disputeBlocked: false } },
      ).exec();
    }

    return result.modifiedCount;
  }

  /**
   * Compensación: PENDING/AVAILABLE/BLOCKED → REVERSED; PAID → asiento negativo ADJUSTMENT.
   */
  async reverseForTransaction(
    transactionId: string,
    reason: string,
  ): Promise<number> {
    const commissions = await AgentCommissionModel.find({
      transaction: new Types.ObjectId(transactionId),
      status: {
        $in: [
          AgentCommissionStatus.PENDING,
          AgentCommissionStatus.AVAILABLE,
          AgentCommissionStatus.BLOCKED,
          AgentCommissionStatus.RESERVED,
          AgentCommissionStatus.PAID,
        ],
      },
      deletedAt: null,
    }).exec();

    let reversed = 0;
    const now = new Date();
    for (const commission of commissions) {
      const prev = commission.status;
      const agentId = String(commission.agent);
      const amount = commission.agentShareCents;

      if (prev === AgentCommissionStatus.PAID) {
        await UserModel.updateOne(
          { _id: agentId },
          {
            $inc: { 'wallet.availableCents': -amount },
            $set: { 'wallet.lastMovementAt': now },
          },
        ).exec();
        await walletLedger.record({
          userId: agentId,
          type: WalletMovementType.ADJUSTMENT,
          direction: WalletMovementDirection.DEBIT,
          amountCents: amount,
          currency: commission.currency,
          description: `Ajuste por ${reason}`,
          transactionId,
          metadata: { commissionId: String(commission._id), reason },
        });
      } else if (prev === AgentCommissionStatus.PENDING || prev === AgentCommissionStatus.BLOCKED) {
        await UserModel.updateOne(
          { _id: agentId },
          {
            $inc: { 'wallet.pendingCents': -amount },
            $set: { 'wallet.lastMovementAt': now },
          },
        ).exec();
        await walletLedger.record({
          userId: agentId,
          type: WalletMovementType.ADJUSTMENT,
          direction: WalletMovementDirection.DEBIT,
          amountCents: amount,
          currency: commission.currency,
          description: `Reverso comisión pendiente · ${reason}`,
          transactionId,
          metadata: { commissionId: String(commission._id), reason },
        });
      } else if (
        prev === AgentCommissionStatus.AVAILABLE ||
        prev === AgentCommissionStatus.RESERVED
      ) {
        await UserModel.updateOne(
          { _id: agentId },
          {
            $inc: { 'wallet.availableCents': -amount },
            $set: { 'wallet.lastMovementAt': now },
          },
        ).exec();
        await walletLedger.record({
          userId: agentId,
          type: WalletMovementType.ADJUSTMENT,
          direction: WalletMovementDirection.DEBIT,
          amountCents: amount,
          currency: commission.currency,
          description: `Reverso comisión disponible · ${reason}`,
          transactionId,
          metadata: { commissionId: String(commission._id), reason },
        });
      }

      commission.status = AgentCommissionStatus.REVERSED;
      await commission.save();

      await financialAudit.record({
        action: 'COMMISSION_REVERSED',
        idempotencyKey: `fa:reverse:${String(commission._id)}:${reason}`,
        operationId: transactionId,
        commissionId: String(commission._id),
        agentId,
        actorRole: 'SYSTEM',
        amountCents: amount,
        currency: commission.currency,
        previousStatus: prev,
        newStatus: AgentCommissionStatus.REVERSED,
        metadata: { reason },
      });
      reversed += 1;
    }
    return reversed;
  }

  async getAgentBalances(agentId: string) {
    const id = String(agentId);
    const rows = await AgentCommissionModel.aggregate<{
      _id: string;
      total: number;
    }>([
      {
        $match: {
          agent: new Types.ObjectId(id),
          deletedAt: null,
          status: {
            $in: [
              AgentCommissionStatus.PENDING,
              AgentCommissionStatus.AVAILABLE,
              AgentCommissionStatus.RESERVED,
              AgentCommissionStatus.PAID,
              AgentCommissionStatus.BLOCKED,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$agentShareCents' },
        },
      },
    ]).exec();

    const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.total])) as Record<
      string,
      number
    >;
    const pending =
      (byStatus[AgentCommissionStatus.PENDING] ?? 0) +
      (byStatus[AgentCommissionStatus.BLOCKED] ?? 0);
    const available = byStatus[AgentCommissionStatus.AVAILABLE] ?? 0;
    const reserved = byStatus[AgentCommissionStatus.RESERVED] ?? 0;
    const paid = byStatus[AgentCommissionStatus.PAID] ?? 0;
    const earned = pending + available + reserved + paid;

    return {
      currency: 'UYU',
      earnedCents: earned,
      pendingCents: pending,
      availableCents: available,
      reservedCents: reserved,
      paidCents: paid,
    };
  }

  async listForAgent(agentId: string, limit = 50) {
    const items = await AgentCommissionModel.find({
      agent: new Types.ObjectId(agentId),
      deletedAt: null,
    })
      .sort({ completedAt: -1 })
      .limit(Math.min(100, Math.max(1, limit)))
      .lean()
      .exec();
    return items.map(toDto);
  }

  async listAvailableForPayout(agentIds?: string[]) {
    const query: Record<string, unknown> = {
      status: AgentCommissionStatus.AVAILABLE,
      disputeBlocked: false,
      deletedAt: null,
    };
    if (agentIds?.length) {
      query.agent = { $in: agentIds.map((id) => new Types.ObjectId(id)) };
    }
    return AgentCommissionModel.find(query).sort({ availableAt: 1 }).lean().exec();
  }
}

export const agentCommissionService = new AgentCommissionService();

/** Guard: comisiones de agente no usan withdrawal self-service. */
export function assertNotAgentCommissionWithdrawal(): never {
  throw new ValidationError(
    'Las comisiones de agente se liquidan por transferencia manual del 1 al 10 de cada mes. Contactá a soporte si necesitás ayuda.',
  );
}

export { PaymentType };
