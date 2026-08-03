import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { ChatsController } from './controller';
import {
  chatIdParamsSchema,
  listMessagesQuerySchema,
  markReadBodySchema,
  sendMessageBodySchema,
} from './validation';

const controller = new ChatsController();

export const chatsRoutes: Router = Router();

chatsRoutes.get('/', authenticate, asyncHandler(controller.listMine));

chatsRoutes.get(
  '/:id/messages',
  authenticate,
  validateRequest({ params: chatIdParamsSchema, query: listMessagesQuerySchema }),
  asyncHandler(controller.listMessages),
);

chatsRoutes.post(
  '/:id/messages',
  authenticate,
  validateRequest({ params: chatIdParamsSchema, body: sendMessageBodySchema }),
  asyncHandler(controller.sendMessage),
);

chatsRoutes.post(
  '/:id/read',
  authenticate,
  validateRequest({ params: chatIdParamsSchema, body: markReadBodySchema }),
  asyncHandler(controller.markRead),
);
