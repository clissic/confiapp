import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { env } from '../../shared/config/env';
import { ForbiddenError } from '../../shared/errors/app-error';

import { FinanceController } from './controller';

const controller = new FinanceController();

function assertJobSecret(header: string | undefined): void {
  const secret = env.TRANSACTIONS_JOB_SECRET?.trim();
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      throw new ForbiddenError('Job secret no configurado');
    }
    return;
  }
  if (header !== secret) {
    throw new ForbiddenError('Job secret inválido');
  }
}

export const financeRoutes: Router = Router();

financeRoutes.get(
  '/agent/me',
  authenticate,
  asyncHandler(controller.myAgentWallet),
);

financeRoutes.get(
  '/agent/:agentId',
  authenticate,
  asyncHandler(controller.agentBalances),
);

financeRoutes.post('/jobs/release-commissions', asyncHandler(async (req, res) => {
  assertJobSecret(req.header('x-job-secret') ?? undefined);
  await controller.releaseDueCommissions(req, res);
}));

financeRoutes.get(
  '/payout-batches',
  authenticate,
  asyncHandler(controller.listBatches),
);

financeRoutes.post(
  '/payout-batches',
  authenticate,
  validateRequest({
    body: z.object({
      agentIds: z.array(z.string()).optional(),
      notes: z.string().max(2000).optional(),
      allowOutsideWindow: z.boolean().optional(),
    }),
  }),
  asyncHandler(controller.createBatch),
);

financeRoutes.get(
  '/payout-batches/:batchId',
  authenticate,
  asyncHandler(controller.getBatch),
);

financeRoutes.post(
  '/payouts/:payoutId/confirm',
  authenticate,
  validateRequest({
    body: z.object({
      transferReference: z.string().trim().min(1).max(200),
      transferDate: z.string().optional(),
      paymentMethod: z.string().max(120).optional(),
      proofUrl: z.string().url().max(2000).optional(),
      notes: z.string().max(2000).optional(),
    }),
  }),
  asyncHandler(controller.confirmPayout),
);

financeRoutes.get(
  '/reconcile/operations/:operationId',
  authenticate,
  asyncHandler(controller.reconcileOperation),
);

financeRoutes.get(
  '/reconcile/agents/:agentId',
  authenticate,
  asyncHandler(controller.reconcileAgent),
);

financeRoutes.get(
  '/audit',
  authenticate,
  asyncHandler(controller.listAudit),
);
