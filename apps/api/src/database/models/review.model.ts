import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IReview } from '@confiapp/database';

import { applyReviewIndexes } from '../indexes/review.indexes';
import { reviewSchema } from '../schemas/review.schema';

export type ReviewDocument = HydratedDocument<IReview>;

applyReviewIndexes(reviewSchema);

export const ReviewModel: Model<IReview> =
  (models.Review as Model<IReview> | undefined) ??
  model<IReview>('Review', reviewSchema);
