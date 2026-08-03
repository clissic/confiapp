import { Router } from 'express';

import {
  asyncHandler,
  authRateLimiter,
  authenticate,
  validateRequest,
} from '../../middleware';
import { AuthController } from './controller';
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
  resendVerificationBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from './validation';

const controller = new AuthController();

export const authRoutes: Router = Router();

authRoutes.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: registerBodySchema }),
  asyncHandler(controller.register),
);

authRoutes.post(
  '/login',
  authRateLimiter,
  validateRequest({ body: loginBodySchema }),
  asyncHandler(controller.login),
);

authRoutes.post(
  '/refresh',
  authRateLimiter,
  validateRequest({ body: refreshBodySchema }),
  asyncHandler(controller.refresh),
);

authRoutes.post(
  '/logout',
  validateRequest({ body: logoutBodySchema }),
  asyncHandler(controller.logout),
);

authRoutes.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    req.body = { ...(req.body as object), allDevices: true };
    await controller.logout(req, res);
  }),
);

authRoutes.post(
  '/change-password',
  authenticate,
  validateRequest({ body: changePasswordBodySchema }),
  asyncHandler(controller.changePassword),
);

authRoutes.post(
  '/forgot-password',
  authRateLimiter,
  validateRequest({ body: forgotPasswordBodySchema }),
  asyncHandler(controller.forgotPassword),
);

authRoutes.post(
  '/reset-password',
  authRateLimiter,
  validateRequest({ body: resetPasswordBodySchema }),
  asyncHandler(controller.resetPassword),
);

authRoutes.post(
  '/verify-email',
  authRateLimiter,
  validateRequest({ body: verifyEmailBodySchema }),
  asyncHandler(controller.verifyEmail),
);

authRoutes.post(
  '/resend-verification',
  authRateLimiter,
  validateRequest({ body: resendVerificationBodySchema }),
  asyncHandler(controller.resendVerification),
);

authRoutes.get('/me', authenticate, asyncHandler(controller.me));
