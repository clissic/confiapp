import type { Types } from 'mongoose';

import type { AgentCommissionStatus } from '../types/enums';

/**
 * Comisión del agente por operación completada.
 * Fuente de verdad del hold de 21 días y liquidación manual.
 */
export interface IAgentCommission {
  transaction: Types.ObjectId;
  agent: Types.ObjectId;
  payment?: Types.ObjectId;
  commissionCents: number;
  agentShareCents: number;
  platformShareCents: number;
  currency: string;
  status: AgentCommissionStatus;
  completedAt: Date;
  availableAt: Date;
  disputeBlocked: boolean;
  payout?: Types.ObjectId;
  payoutBatch?: Types.ObjectId;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
