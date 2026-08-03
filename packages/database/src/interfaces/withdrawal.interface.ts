import type { Types } from 'mongoose';

import type { WithdrawalStatus } from '../types/enums';

/**
 * Solicitud de retiro desde saldo disponible.
 */
export interface IWithdrawal {
  user: Types.ObjectId;
  amountCents: number;
  currency: string;
  status: WithdrawalStatus;
  /** Alias / CVU / hint de destino (nunca PAN completo). */
  destinationHint?: string;
  requestedAt: Date;
  processedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
