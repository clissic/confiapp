import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { AuditController } from './controller';
import { auditListQuerySchema } from './validation';

const controller = new AuditController();

export const auditRoutes: Router = Router();

auditRoutes.get(
  '/',
  authenticate,
  validateRequest({ query: auditListQuerySchema }),
  asyncHandler(controller.list),
);
