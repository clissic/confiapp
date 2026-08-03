import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IWithdrawal } from '../interfaces/withdrawal.interface';
import { WithdrawalStatus } from '../types/enums';

export type WithdrawalDocument = HydratedDocument<IWithdrawal>;

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    user: {
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
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: Object.values(WithdrawalStatus),
      default: WithdrawalStatus.PENDING,
      index: true,
    },
    destinationHint: { type: String, trim: true, maxlength: 120 },
    requestedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
    failureReason: { type: String, trim: true, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'withdrawals' },
);

withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ user: 1, status: 1 });

export const WithdrawalModel: Model<IWithdrawal> = model<IWithdrawal>(
  'Withdrawal',
  withdrawalSchema,
);
