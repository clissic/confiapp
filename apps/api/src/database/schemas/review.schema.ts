import { Schema } from 'mongoose';
import {
  ReviewFraudFlag,
  ReviewVisibility,
  TransactionPartyRole,
  type IReview,
} from '@confiapp/database';

export const reviewSchema = new Schema<IReview>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'transaction is required'],
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reviewer is required'],
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reviewee is required'],
    },
    reviewerRole: {
      type: String,
      enum: Object.values(TransactionPartyRole),
      required: true,
    },
    revieweeRole: {
      type: String,
      enum: Object.values(TransactionPartyRole),
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'rating min is 1'],
      max: [5, 'rating max is 5'],
      validate: {
        validator: Number.isInteger,
        message: 'rating must be an integer 1–5',
      },
    },
    comment: { type: String, trim: true, maxlength: 2000 },
    weight: { type: Number, default: 1, min: 0, max: 1.2 },
    fraudFlags: {
      type: [{ type: String, enum: Object.values(ReviewFraudFlag) }],
      default: () => [ReviewFraudFlag.NONE],
    },
    visibility: {
      type: String,
      enum: Object.values(ReviewVisibility),
      default: ReviewVisibility.PUBLIC,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'reviews' },
);

reviewSchema.pre('validate', function (next) {
  if (this.reviewer && this.reviewee && String(this.reviewer) === String(this.reviewee)) {
    next(new Error('reviewer and reviewee must be different'));
    return;
  }
  next();
});
