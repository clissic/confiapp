import { randomUUID } from 'node:crypto';

import {
  FinancialAuditEventModel,
  type IFinancialAuditEvent,
} from '@confiapp/database';
import { Types } from 'mongoose';

import { logger } from '../../utils/logger';

export type FinancialAuditInput = {
  action: string;
  idempotencyKey: string;
  operationId?: string;
  paymentId?: string;
  commissionId?: string;
  agentId?: string;
  payoutId?: string;
  payoutBatchId?: string;
  actorId?: string;
  actorRole?: string;
  amountCents?: number;
  currency?: string;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Auditoría financiera append-only. Duplicados por idempotencyKey se ignoran.
 */
export class FinancialAuditService {
  async record(input: FinancialAuditInput): Promise<IFinancialAuditEvent | null> {
    try {
      const doc = await FinancialAuditEventModel.create({
        eventId: randomUUID(),
        operationId: input.operationId
          ? new Types.ObjectId(input.operationId)
          : undefined,
        paymentId: input.paymentId ? new Types.ObjectId(input.paymentId) : undefined,
        commissionId: input.commissionId
          ? new Types.ObjectId(input.commissionId)
          : undefined,
        agentId: input.agentId ? new Types.ObjectId(input.agentId) : undefined,
        payoutId: input.payoutId ? new Types.ObjectId(input.payoutId) : undefined,
        payoutBatchId: input.payoutBatchId
          ? new Types.ObjectId(input.payoutBatchId)
          : undefined,
        actorId: input.actorId ? new Types.ObjectId(input.actorId) : undefined,
        actorRole: input.actorRole,
        action: input.action,
        amountCents: input.amountCents,
        currency: input.currency?.toUpperCase(),
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        metadata: input.metadata,
        idempotencyKey: input.idempotencyKey,
      });
      return doc.toObject();
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: number }).code
          : undefined;
      if (code === 11000) {
        logger.info('financial audit duplicate ignored', {
          key: input.idempotencyKey,
          action: input.action,
        });
        return null;
      }
      logger.error('financial audit persist failed', { error, input });
      return null;
    }
  }

  async list(filters: {
    operationId?: string;
    agentId?: string;
    limit?: number;
    page?: number;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.operationId) {
      query.operationId = new Types.ObjectId(filters.operationId);
    }
    if (filters.agentId) {
      query.agentId = new Types.ObjectId(filters.agentId);
    }
    const limit = Math.min(200, Math.max(1, filters.limit ?? 15));
    const page = Math.max(1, filters.page ?? 1);

    const [items, total] = await Promise.all([
      FinancialAuditEventModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      FinancialAuditEventModel.countDocuments(query),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return { items, total, page, limit, totalPages };
  }
}

export const financialAudit = new FinancialAuditService();
