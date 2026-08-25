import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';

import { DisputesController } from './controller';

const controller = new DisputesController();

export const disputesRoutes: Router = Router();

disputesRoutes.get('/status', asyncHandler(controller.getStatus));

disputesRoutes.post(
  '/transactions/:code/open',
  authenticate,
  validateRequest({
    body: z.object({
      reason: z.string().trim().min(3).max(500),
    }),
  }),
  asyncHandler(controller.open),
);

disputesRoutes.post(
  '/:disputeId/resolve',
  authenticate,
  validateRequest({
    body: z.object({
      outcome: z.enum(['RESUME', 'CANCEL', 'COMPLETE_WITH_REFUND']),
      notes: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(controller.resolve),
);
