import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IFinancialAuditEvent } from '../interfaces/financial-audit-event.interface';

export type FinancialAuditEventDocument = HydratedDocument<IFinancialAuditEvent>;

const financialAuditEventSchema = new Schema<IFinancialAuditEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    operationId: { type: Schema.Types.ObjectId, ref: 'Transaction', index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    commissionId: { type: Schema.Types.ObjectId, ref: 'AgentCommission', index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    payoutId: { type: Schema.Types.ObjectId, ref: 'AgentPayout', index: true },
    payoutBatchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String, trim: true, maxlength: 40 },
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    amountCents: {
      type: Number,
      min: 0,
      validate: {
        validator: (v: number | undefined) => v == null || Number.isInteger(v),
        message: 'amountCents must be integer',
      },
    },
    currency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
    previousStatus: { type: String, trim: true, maxlength: 40 },
    newStatus: { type: String, trim: true, maxlength: 40 },
    metadata: { type: Schema.Types.Mixed },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 160,
    },
  },
  { timestamps: true, collection: 'financial_audit_events' },
);

financialAuditEventSchema.index({ operationId: 1, createdAt: -1 });
financialAuditEventSchema.index({ agentId: 1, createdAt: -1 });
financialAuditEventSchema.index({ action: 1, createdAt: -1 });

export const FinancialAuditEventModel: Model<IFinancialAuditEvent> =
  model<IFinancialAuditEvent>('FinancialAuditEvent', financialAuditEventSchema);
