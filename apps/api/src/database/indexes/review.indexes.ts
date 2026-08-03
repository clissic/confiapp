import type { Schema } from 'mongoose';
import type { IReview } from '@confiapp/database';

export function applyReviewIndexes(schema: Schema<IReview>): void {
  schema.index({ transaction: 1 });
  schema.index({ reviewer: 1 });
  schema.index({ reviewee: 1 });
  schema.index({ deletedAt: 1 });
  schema.index(
    { transaction: 1, reviewer: 1, reviewee: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } },
  );
  schema.index({ reviewee: 1, rating: -1, createdAt: -1 });
  schema.index({ revieweeRole: 1, createdAt: -1 });
  schema.index({ reviewer: 1, createdAt: -1 });
  schema.index({ visibility: 1, createdAt: -1 });
}
