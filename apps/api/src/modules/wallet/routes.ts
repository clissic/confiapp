import { Router } from 'express';
import { PlatformRole } from '@confiapp/database';
import { z } from 'zod';

import { asyncHandler, authenticate, requireRoles, validateRequest } from '../../middleware';
import { WalletController } from './controller';
import {
  walletCommissionsQuerySchema,
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
walletRoutes.get(
  '/commissions',
  authenticate,
  validateRequest({ query: walletCommissionsQuerySchema }),
  asyncHandler(controller.commissions),
);
walletRoutes.get('/withdrawals', authenticate, asyncHandler(controller.withdrawals));
walletRoutes.get(
  '/admin/withdrawals',
  authenticate,
  requireRoles(PlatformRole.ADMIN),
  validateRequest({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  }),
  asyncHandler(controller.adminPendingWithdrawals),
);
walletRoutes.post(
  '/withdrawals',
  authenticate,
  validateRequest({ body: walletWithdrawBodySchema }),
  asyncHandler(controller.requestWithdrawal),
);
walletRoutes.post(
  '/withdrawals/:id/complete',
  authenticate,
  requireRoles(PlatformRole.ADMIN),
  validateRequest({ params: walletWithdrawalIdParamsSchema }),
  asyncHandler(controller.completeWithdrawal),
);
walletRoutes.get('/export', authenticate, asyncHandler(controller.exportCsv));
