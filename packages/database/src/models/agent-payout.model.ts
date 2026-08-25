import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IAgentPayout } from '../interfaces/agent-payout.interface';
import { AgentPayoutStatus } from '../types/enums';

export type AgentPayoutDocument = HydratedDocument<IAgentPayout>;

const agentPayoutSchema = new Schema<IAgentPayout>(
  {
    batch: {
      type: Schema.Types.ObjectId,
      ref: 'PayoutBatch',
      required: true,
      index: true,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amountCents must be integer' },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'UYU',
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: Object.values(AgentPayoutStatus),
      required: true,
      default: AgentPayoutStatus.PENDING,
      index: true,
    },
    commissionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AgentCommission',
        required: true,
      },
    ],
    transferDate: { type: Date },
    transferReference: { type: String, trim: true, maxlength: 200 },
    paymentMethod: { type: String, trim: true, maxlength: 120 },
    proofUrl: { type: String, trim: true, maxlength: 2000 },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    processedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000 },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'agent_payouts' },
);

agentPayoutSchema.index(
  { batch: 1, agent: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
agentPayoutSchema.index({ agent: 1, status: 1, createdAt: -1 });

export const AgentPayoutModel: Model<IAgentPayout> = model<IAgentPayout>(
  'AgentPayout',
  agentPayoutSchema,
);
