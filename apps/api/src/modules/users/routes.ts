import { Router } from 'express';
import { PlatformRole } from '@confiapp/database';
import { z } from 'zod';

import {
  asyncHandler,
  authenticate,
  authRateLimiter,
  requireRoles,
  validateRequest,
} from '../../middleware';
import { UsersController } from './controller';
import {
  registerUserBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from './validation';

const controller = new UsersController();

const kycTokenParamsSchema = z.object({
  token: z.string().trim().min(20).max(128),
});

const kycDecisionBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(1000).optional(),
});

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

usersRoutes.post(
  '/me/identity-change-request',
  authenticate,
  authRateLimiter,
  validateRequest({
    body: z.object({
      message: z.string().trim().min(10).max(2000),
      attachmentDataUrl: z
        .string()
        .trim()
        .max(5_500_000)
        .refine(
          (value) =>
            value.startsWith('data:image/') || value.startsWith('data:application/pdf'),
          'Se espera data:image o data:application/pdf',
        )
        .optional(),
    }),
  }),
  asyncHandler(controller.requestIdentityChange),
);

usersRoutes.get(
  '/kyc-reviews/:token',
  authenticate,
  requireRoles(PlatformRole.ADMIN),
  validateRequest({ params: kycTokenParamsSchema }),
  asyncHandler(controller.getKycReview),
);

usersRoutes.post(
  '/kyc-reviews/:token/decide',
  authenticate,
  requireRoles(PlatformRole.ADMIN),
  validateRequest({ params: kycTokenParamsSchema, body: kycDecisionBodySchema }),
  asyncHandler(controller.decideKycReview),
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
