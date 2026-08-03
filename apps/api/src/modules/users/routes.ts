import { Router } from 'express';

import {
  asyncHandler,
  authenticate,
  authRateLimiter,
  validateRequest,
} from '../../middleware';
import { UsersController } from './controller';
import {
  registerUserBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './validation';

const controller = new UsersController();

export const usersRoutes: Router = Router();

/** @deprecated Prefer POST /auth/register */
usersRoutes.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: registerUserBodySchema }),
  asyncHandler(controller.register),
);

usersRoutes.get('/me', authenticate, asyncHandler(controller.me));

usersRoutes.patch(
  '/me',
  authenticate,
  validateRequest({ body: updateUserBodySchema }),
  asyncHandler(controller.updateMe),
);

usersRoutes.get(
  '/:id',
  authenticate,
  validateRequest({ params: userIdParamsSchema }),
  asyncHandler(controller.getById),
);

usersRoutes.patch(
  '/:id',
  authenticate,
  validateRequest({ params: userIdParamsSchema, body: updateUserBodySchema }),
  asyncHandler(controller.updateById),
);
