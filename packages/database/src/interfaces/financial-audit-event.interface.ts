import type { Types } from 'mongoose';

/**
 * Evento append-only de auditoría financiera (no editable / no borrable).
 */
export interface IFinancialAuditEvent {
  eventId: string;
  operationId?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  commissionId?: Types.ObjectId;
  agentId?: Types.ObjectId;
  payoutId?: Types.ObjectId;
  payoutBatchId?: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole?: string;
  action: string;
  amountCents?: number;
  currency?: string;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}