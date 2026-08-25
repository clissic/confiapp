import type { Types } from 'mongoose';

import type { PayoutBatchStatus } from '../types/enums';

export interface IPayoutBatch {
  createdBy: Types.ObjectId;
  totalAmountCents: number;
  currency: string;
  numberOfPayouts: number;
  status: PayoutBatchStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
