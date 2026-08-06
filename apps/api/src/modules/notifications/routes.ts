import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { NotificationsController } from './controller';
import {
  notificationIdParamsSchema,
  notificationsListQuerySchema,
} from './validation';

const controller = new NotificationsController();

export const notificationsRoutes: Router = Router();

notificationsRoutes.get(
  '/',
  authenticate,
  validateRequest({ query: notificationsListQuerySchema }),
  asyncHandler(controller.list),
);

notificationsRoutes.get(
  '/unread-count',
  authenticate,
  asyncHandler(controller.unreadCount),
);

notificationsRoutes.patch(
  '/:id/read',
  authenticate,
  validateRequest({ params: notificationIdParamsSchema }),
  asyncHandler(controller.markRead),
);

notificationsRoutes.post(
  '/read-all',
  authenticate,
  asyncHandler(controller.markAllRead),
);
