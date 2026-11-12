import { Router } from 'express';

import {
  asyncHandler,
  authenticate,
  mediaRateLimiter,
  validateRequest,
} from '../../middleware';
import { MediaController } from './controller';
import {
  confirmBodySchema,
  presignBodySchema,
  signedUrlBodySchema,
} from './validation';

const controller = new MediaController();

export const mediaRoutes: Router = Router();

mediaRoutes.get('/status', authenticate, asyncHandler(controller.status));

mediaRoutes.post(
  '/presign',
  authenticate,
  mediaRateLimiter,
  validateRequest({ body: presignBodySchema }),
  asyncHandler(controller.presign),
);

mediaRoutes.post(
  '/confirm',
  authenticate,
  mediaRateLimiter,
  validateRequest({ body: confirmBodySchema }),
  asyncHandler(controller.confirm),
);

mediaRoutes.post(
  '/signed-url',
  authenticate,
  mediaRateLimiter,
  validateRequest({ body: signedUrlBodySchema }),
  asyncHandler(controller.signedUrl),
);
