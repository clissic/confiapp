import {
  AgentCommissionModel,
  AgentCommissionStatus,
  AgentPayoutModel,
  PaymentModel,
  PaymentType,
  TransactionModel,
} from '@confiapp/database';
import { Types } from 'mongoose';

import { NotFoundError } from '../../shared/errors/app-error';

export type ReconcileIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warn';
  meta?: Record<string, unknown>;
};

export class FinanceReconcileService {
  async reconcileOperation(operationId: string): Promise<{
    operationId: string;
    ok: boolean;
    issues: ReconcileIssue[];
  }> {
    const issues: ReconcileIssue[] = [];
    const tx = await TransactionModel.findById(operationId).lean();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const payments = await PaymentModel.find({
      transaction: tx._id,
      deletedAt: null,
    })
      .lean()
      .exec();

    const holds = payments.filter((p) => p.type === PaymentType.ESCROW_HOLD);
    const releases = payments.filter((p) => p.type === PaymentType.ESCROW_RELEASE);
    const fees = payments.filter((p) => p.type === PaymentType.PLATFORM_FEE);

    if (tx.status === 'COMPLETED') {
      if (!holds.length) {
        issues.push({
          code: 'MISSING_HOLD',
          message: 'Operación COMPLETED sin ESCROW_HOLD',
          severity: 'error',
        });
      }
      if (!releases.length) {
        issues.push({
          code: 'MISSING_RELEASE',
          message: 'Operación COMPLETED sin ESCROW_RELEASE',
          severity: 'error',
        });
      }
      if (releases.length > 1) {
        issues.push({
          code: 'DUPLICATE_RELEASE',
          message: 'Más de un ESCROW_RELEASE',
          severity: 'error',
          meta: { count: releases.length },
        });
      }
      if (!fees.length) {
        issues.push({
          code: 'MISSING_PLATFORM_FEE',
          message: 'Operación COMPLETED sin PLATFORM_FEE',
          severity: 'warn',
        });
      }
    }

    const commissions = await AgentCommissionModel.find({
      transaction: tx._id,
      deletedAt: null,
    })
      .lean()
      .exec();

    if (commissions.length > 1) {
      issues.push({
        code: 'DUPLICATE_COMMISSION',
        message: 'Más de una comisión de agente para la operación',
        severity: 'error',
        meta: { count: commissions.length },
      });
    }

    for (const c of commissions) {
      if (c.agentShareCents + c.platformShareCents !== c.commissionCents) {
        issues.push({
          code: 'COMMISSION_SPLIT_MISMATCH',
          message: 'agentShare + platformShare ≠ commission',
          severity: 'error',
          meta: { commissionId: String(c._id) },
        });
      }
      if (
        c.status === AgentCommissionStatus.PAID &&
        !c.payout
      ) {
        issues.push({
          code: 'PAID_WITHOUT_PAYOUT',
          message: 'Comisión PAID sin payout',
          severity: 'error',
          meta: { commissionId: String(c._id) },
        });
      }
    }

    return {
      operationId: String(tx._id),
      ok: issues.every((i) => i.severity !== 'error'),
      issues,
    };
  }

  async reconcileAgent(agentId: string): Promise<{
    agentId: string;
    ok: boolean;
    issues: ReconcileIssue[];
    balances: Awaited<
      ReturnType<typeof import('./commission.service').agentCommissionService.getAgentBalances>
    >;
  }> {
    const { agentCommissionService } = await import('./commission.service');
    const issues: ReconcileIssue[] = [];
    const balances = await agentCommissionService.getAgentBalances(agentId);

    const commissions = await AgentCommissionModel.find({
      agent: new Types.ObjectId(agentId),
      deletedAt: null,
    })
      .lean()
      .exec();

    const payouts = await AgentPayoutModel.find({
      agent: new Types.ObjectId(agentId),
      deletedAt: null,
    })
      .lean()
      .exec();

    const paidFromCommissions = commissions
      .filter((c) => c.status === AgentCommissionStatus.PAID)
      .reduce((s, c) => s + c.agentShareCents, 0);
    const paidFromPayouts = payouts
      .filter((p) => p.status === 'PAID')
      .reduce((s, p) => s + p.amountCents, 0);

    if (paidFromCommissions !== paidFromPayouts) {
      issues.push({
        code: 'PAID_MISMATCH',
        message: 'Suma PAID de comisiones ≠ suma payouts PAID',
        severity: 'error',
        meta: { paidFromCommissions, paidFromPayouts },
      });
    }

    const reservedWithoutPayout = commissions.filter(
      (c) => c.status === AgentCommissionStatus.RESERVED && !c.payout,
    );
    if (reservedWithoutPayout.length) {
      issues.push({
        code: 'RESERVED_WITHOUT_PAYOUT',
        message: 'Comisiones RESERVED sin payout',
        severity: 'error',
        meta: { count: reservedWithoutPayout.length },
      });
    }

    for (const p of payouts) {
      if (!p.commissionIds?.length) {
        issues.push({
          code: 'PAYOUT_WITHOUT_LEDGER',
          message: 'Payout sin comisiones asociadas',
          severity: 'error',
          meta: { payoutId: String(p._id) },
        });
      }
    }

    return {
      agentId,
      ok: issues.every((i) => i.severity !== 'error'),
      issues,
      balances,
    };
  }
}

export const financeReconcileService = new FinanceReconcileService();
