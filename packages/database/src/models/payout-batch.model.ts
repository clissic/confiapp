import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IPayoutBatch } from '../interfaces/payout-batch.interface';
import { PayoutBatchStatus } from '../types/enums';

export type PayoutBatchDocument = HydratedDocument<IPayoutBatch>;

const payoutBatchSchema = new Schema<IPayoutBatch>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    totalAmountCents: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'totalAmountCents must be integer' },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'UYU',
      minlength: 3,
      maxlength: 3,
    },
    numberOfPayouts: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'numberOfPayouts must be integer' },
    },
    status: {
      type: String,
      enum: Object.values(PayoutBatchStatus),
      required: true,
      default: PayoutBatchStatus.DRAFT,
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'payout_batches' },
);

payoutBatchSchema.index({ status: 1, createdAt: -1 });

export const PayoutBatchModel: Model<IPayoutBatch> = model<IPayoutBatch>(
  'PayoutBatch',
  payoutBatchSchema,
);
