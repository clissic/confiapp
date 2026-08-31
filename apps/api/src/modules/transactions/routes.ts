import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { TransactionsController } from './controller';
import {
  acceptPurchaseBodySchema,
  confirmSaleBodySchema,
  createSellerTransactionBodySchema,
  createTransactionBodySchema,
  finalizeVerificationBodySchema,
  inviteTokenParamsSchema,
  toggleChecklistBodySchema,
  transactionChecklistParamsSchema,
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

transactionsRoutes.patch(
  '/by-code/:code/checklist/:itemId',
  authenticate,
  validateRequest({
    params: transactionChecklistParamsSchema,
    body: toggleChecklistBodySchema,
  }),
  asyncHandler(controller.toggleChecklistItem),
);

transactionsRoutes.post(
  '/by-code/:code/verification/finalize',
  authenticate,
  validateRequest({
    params: transactionCodeParamsSchema,
    body: finalizeVerificationBodySchema,
  }),
  asyncHandler(controller.finalizeVerification),
);

transactionsRoutes.post(
  '/by-code/:code/product/accept',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.buyerAcceptProduct),
);

transactionsRoutes.post(
  '/by-code/:code/product/reject',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.buyerRejectProduct),
);

transactionsRoutes.post(
  '/by-code/:code/delivery/confirm-arrival',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.buyerConfirmArrival),
);

transactionsRoutes.post(
  '/by-code/:code/delivery/confirm-delivery',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.agentConfirmDelivery),
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
  validateRequest({
    params: inviteTokenParamsSchema,
    body: acceptPurchaseBodySchema,
  }),
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

transactionsRoutes.post(
  '/by-code/:code/buyer-confirm',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.buyerConfirm),
);

transactionsRoutes.post(
  '/by-code/:code/buyer-reject',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.buyerReject),
);

transactionsRoutes.post(
  '/jobs/expire-deadlines',
  asyncHandler(controller.expireDeadlines),
);

transactionsRoutes.post(
  '/jobs/auto-delivery',
  asyncHandler(controller.autoCompleteStaleDeliveries),
);
