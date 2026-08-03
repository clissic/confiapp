import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { WalletController } from './controller';
import {
  walletMovementsQuerySchema,
  walletWithdrawBodySchema,
  walletWithdrawalIdParamsSchema,
} from './validation';

const controller = new WalletController();

export const walletRoutes: Router = Router();

walletRoutes.get('/', authenticate, asyncHandler(controller.summary));
walletRoutes.get(
  '/movements',
  authenticate,
  validateRequest({ query: walletMovementsQuerySchema }),
  asyncHandler(controller.movements),
);
walletRoutes.get('/commissions', authenticate, asyncHandler(controller.commissions));
walletRoutes.get('/withdrawals', authenticate, asyncHandler(controller.withdrawals));
walletRoutes.post(
  '/withdrawals',
  authenticate,
  validateRequest({ body: walletWithdrawBodySchema }),
  asyncHandler(controller.requestWithdrawal),
);
walletRoutes.post(
  '/withdrawals/:id/complete',
  authenticate,
  validateRequest({ params: walletWithdrawalIdParamsSchema }),
  asyncHandler(controller.completeWithdrawal),
);
walletRoutes.get('/export', authenticate, asyncHandler(controller.exportCsv));
