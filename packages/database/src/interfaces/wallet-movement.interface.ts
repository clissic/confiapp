import type { Types } from 'mongoose';

import type { WalletMovementDirection, WalletMovementType } from '../types/enums';

export interface WalletBalanceSnapshot {
  availableCents: number;
  pendingCents: number;
  heldCents: number;
}

/**
 * Movimiento del ledger de wallet (inmutable).
 */
export interface IWalletMovement {
  user: Types.ObjectId;
  type: WalletMovementType;
  direction: WalletMovementDirection;
  amountCents: number;
  currency: string;
  description: string;
  balanceAfter?: WalletBalanceSnapshot;
  payment?: Types.ObjectId;
  transaction?: Types.ObjectId;
  withdrawal?: Types.ObjectId;
  agentCommission?: Types.ObjectId;
  agentPayout?: Types.ObjectId;
  payoutBatch?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
