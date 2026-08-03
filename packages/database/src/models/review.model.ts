import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IReview } from '../interfaces/review.interface';
import {
  ReviewFraudFlag,
  ReviewVisibility,
  TransactionPartyRole,
} from '../types/enums';

export type ReviewDocument = HydratedDocument<IReview>;

const reviewSchema = new Schema<IReview>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerRole: {
      type: String,
      enum: Object.values(TransactionPartyRole),
      required: true,
      index: true,
    },
    revieweeRole: {
      type: String,
      enum: Object.values(TransactionPartyRole),
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'rating must be an integer 1–5',
      },
    },
    comment: { type: String, trim: true, maxlength: 2000 },
    weight: { type: Number, default: 1, min: 0, max: 1.2 },
    fraudFlags: {
      type: [
        {
          type: String,
          enum: Object.values(ReviewFraudFlag),
        },
      ],
      default: () => [ReviewFraudFlag.NONE],
    },
    visibility: {
      type: String,
      enum: Object.values(ReviewVisibility),
      default: ReviewVisibility.PUBLIC,
      index: true,
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'reviews',
  },
);

reviewSchema.index(
  { transaction: 1, reviewer: 1, reviewee: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
reviewSchema.index({ reviewee: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ revieweeRole: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });

reviewSchema.pre('validate', function (next) {
  if (this.reviewer && this.reviewee && String(this.reviewer) === String(this.reviewee)) {
    next(new Error('reviewer and reviewee must be different'));
    return;
  }
  next();
});

export const ReviewModel: Model<IReview> = model<IReview>('Review', reviewSchema);
