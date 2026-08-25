import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IAgentCommission } from '../interfaces/agent-commission.interface';
import { AgentCommissionStatus } from '../types/enums';

export type AgentCommissionDocument = HydratedDocument<IAgentCommission>;

const agentCommissionSchema = new Schema<IAgentCommission>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    commissionCents: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'commissionCents must be integer' },
    },
    agentShareCents: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'agentShareCents must be integer' },
    },
    platformShareCents: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'platformShareCents must be integer' },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'UYU',
    },
    status: {
      type: String,
      enum: Object.values(AgentCommissionStatus),
      required: true,
      default: AgentCommissionStatus.PENDING,
      index: true,
    },
    completedAt: { type: Date, required: true, index: true },
    availableAt: { type: Date, required: true, index: true },
    disputeBlocked: { type: Boolean, required: true, default: false, index: true },
    payout: { type: Schema.Types.ObjectId, ref: 'AgentPayout', index: true },
    payoutBatch: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', index: true },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    metadata: { type: Schema.Types.Mixed },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'agent_commissions' },
);

agentCommissionSchema.index({ agent: 1, status: 1, availableAt: 1 });
agentCommissionSchema.index(
  { transaction: 1, agent: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
agentCommissionSchema.index({
  status: 1,
  availableAt: 1,
  disputeBlocked: 1,
  deletedAt: 1,
});

export const AgentCommissionModel: Model<IAgentCommission> = model<IAgentCommission>(
  'AgentCommission',
  agentCommissionSchema,
);
