import type { Types } from 'mongoose';

import type { AgentPayoutStatus } from '../types/enums';

/**
 * Liquidación manual de un agente dentro de un PayoutBatch.
 */
export interface IAgentPayout {
  batch: Types.ObjectId;
  agent: Types.ObjectId;
  amountCents: number;
  currency: string;
  status: AgentPayoutStatus;
  commissionIds: Types.ObjectId[];
  transferDate?: Date;
  transferReference?: string;
  paymentMethod?: string;
  proofUrl?: string;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  notes?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
