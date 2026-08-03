import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IPayment } from '../interfaces/payment.interface';
import {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from '../types/enums';

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    payer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    payee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      default: PaymentProvider.MOCK,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'amountCents must be an integer',
      },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      match: [/^[A-Z]{3}$/, 'currency must be ISO 4217'],
    },
    externalId: { type: String, trim: true, maxlength: 128 },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    failureReason: { type: String, trim: true, maxlength: 1000 },
    authorizedAt: { type: Date },
    capturedAt: { type: Date },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'payments',
  },
);

paymentSchema.index({ idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ transaction: 1, status: 1, createdAt: -1 });
paymentSchema.index({ externalId: 1 }, { sparse: true });
paymentSchema.index({ payer: 1, createdAt: -1 });

export const PaymentModel: Model<IPayment> = model<IPayment>('Payment', paymentSchema);
