import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { TransactionsController } from './controller';
import {
  confirmSaleBodySchema,
  createSellerTransactionBodySchema,
  createTransactionBodySchema,
  inviteTokenParamsSchema,
  transactionCodeParamsSchema,
} from './validation';

const controller = new TransactionsController();

export const transactionsRoutes: Router = Router();

transactionsRoutes.get('/status', asyncHandler(controller.getStatus));

transactionsRoutes.post(
  '/',
  authenticate,
  validateRequest({ body: createTransactionBodySchema }),
  asyncHandler(controller.create),
);

transactionsRoutes.post(
  '/as-seller',
  authenticate,
  validateRequest({ body: createSellerTransactionBodySchema }),
  asyncHandler(controller.createAsSeller),
);

transactionsRoutes.get('/', authenticate, asyncHandler(controller.listMine));

transactionsRoutes.get(
  '/by-code/:code',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.getByCode),
);

transactionsRoutes.post(
  '/by-code/:code/invite/refresh',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.refreshInvite),
);

transactionsRoutes.get(
  '/invite/:token',
  validateRequest({ params: inviteTokenParamsSchema }),
  asyncHandler(controller.previewInvite),
);

transactionsRoutes.post(
  '/invite/:token/join',
  authenticate,
  validateRequest({ params: inviteTokenParamsSchema }),
  asyncHandler(controller.joinInvite),
);

transactionsRoutes.post(
  '/invite/:token/accept-purchase',
  authenticate,
  validateRequest({ params: inviteTokenParamsSchema }),
  asyncHandler(controller.acceptPurchase),
);

transactionsRoutes.post(
  '/invite/:token/confirm-sale',
  authenticate,
  validateRequest({
    params: inviteTokenParamsSchema,
    body: confirmSaleBodySchema,
  }),
  asyncHandler(controller.confirmSale),
);
