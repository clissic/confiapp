import { Router } from 'express';
import { PlatformRole } from '@confiapp/database';

import {
  asyncHandler,
  authenticate,
  requireRoles,
  validateRequest,
} from '../../middleware';
import { env } from '../../shared/config/env';
import { mercadoPagoClient } from '../../infrastructure/payments/mercadopago.client';
import { PaymentsController } from './controller';
import {
  paymentIdParamsSchema,
  paymentLogsQuerySchema,
  paymentTransactionCodeParamsSchema,
} from './validation';

const controller = new PaymentsController();

export const paymentsRoutes: Router = Router();

paymentsRoutes.get('/', authenticate, asyncHandler(controller.listMine));

paymentsRoutes.get(
  '/logs',
  authenticate,
  requireRoles(PlatformRole.ADMIN),
  validateRequest({ query: paymentLogsQuerySchema }),
  asyncHandler(controller.listLogs),
);

paymentsRoutes.get(
  '/transactions/:code',
  authenticate,
  validateRequest({ params: paymentTransactionCodeParamsSchema }),
  asyncHandler(controller.getEscrow),
);

paymentsRoutes.post(
  '/transactions/:code/checkout',
  authenticate,
  validateRequest({ params: paymentTransactionCodeParamsSchema }),
  asyncHandler(controller.checkout),
);

paymentsRoutes.post(
  '/transactions/:code/release',
  authenticate,
  validateRequest({ params: paymentTransactionCodeParamsSchema }),
  asyncHandler(controller.release),
);

/** Confirmación simulada — solo fuera de producción y en modo MOCK. */
if (env.NODE_ENV !== 'production' && mercadoPagoClient.isMock()) {
  paymentsRoutes.post(
    '/mock/confirm/:paymentId',
    validateRequest({ params: paymentIdParamsSchema }),
    asyncHandler(controller.mockConfirm),
  );
  paymentsRoutes.get(
    '/mock/confirm/:paymentId',
    validateRequest({ params: paymentIdParamsSchema }),
    asyncHandler(controller.mockConfirm),
  );
}

/** Webhook público Mercado Pago (verifica firma si hay secret). */
paymentsRoutes.post('/webhooks/mercadopago', asyncHandler(controller.webhook));
paymentsRoutes.get('/webhooks/mercadopago', asyncHandler(controller.webhook));

/** OAuth vendedor: estado / start / disconnect (JWT) + callback público. */
paymentsRoutes.get(
  '/mercadopago/connection',
  authenticate,
  asyncHandler(controller.mpConnectionStatus),
);
paymentsRoutes.get(
  '/mercadopago/oauth/start',
  authenticate,
  asyncHandler(controller.mpOAuthStart),
);
paymentsRoutes.get('/mercadopago/oauth/callback', asyncHandler(controller.mpOAuthCallback));
paymentsRoutes.delete(
  '/mercadopago/connection',
  authenticate,
  asyncHandler(controller.mpDisconnect),
);
