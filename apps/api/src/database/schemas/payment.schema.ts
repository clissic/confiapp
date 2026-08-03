import { Schema } from 'mongoose';
import {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  type IPayment,
} from '@confiapp/database';

export const paymentSchema = new Schema<IPayment>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'transaction is required'],
    },
    payer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'payer is required'],
    },
    payee: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: {
        values: Object.values(PaymentType),
        message: 'Invalid payment type',
      },
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      default: PaymentProvider.MOCK,
    },
    amountCents: {
      type: Number,
      required: true,
      min: [1, 'amountCents must be >= 1'],
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
      required: [true, 'idempotencyKey is required'],
      trim: true,
      maxlength: 128,
    },
    failureReason: { type: String, trim: true, maxlength: 1000 },
    authorizedAt: { type: Date },
    capturedAt: { type: Date },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'payments' },
);
