import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { ReviewsController } from './controller';
import {
  createReviewBodySchema,
  pendingTargetsQuerySchema,
  reputationParamsSchema,
  reviewsListQuerySchema,
} from './validation';

const controller = new ReviewsController();

export const reviewsRoutes: Router = Router();

reviewsRoutes.post(
  '/',
  authenticate,
  validateRequest({ body: createReviewBodySchema }),
  asyncHandler(controller.create),
);

reviewsRoutes.get(
  '/',
  authenticate,
  validateRequest({ query: reviewsListQuerySchema }),
  asyncHandler(controller.list),
);

reviewsRoutes.get(
  '/pending',
  authenticate,
  validateRequest({ query: pendingTargetsQuerySchema }),
  asyncHandler(controller.pendingTargets),
);

reviewsRoutes.get('/reputation/me', authenticate, asyncHandler(controller.myReputation));

reviewsRoutes.get(
  '/reputation/:userId',
  authenticate,
  validateRequest({ params: reputationParamsSchema }),
  asyncHandler(controller.getReputation),
);
