import { Router } from 'express';

import { asyncHandler } from '../../middleware/async-handler';
import { EvidenceController } from './controller';

const controller = new EvidenceController();

export const evidenceRoutes: Router = Router();

evidenceRoutes.get('/status', asyncHandler(controller.getStatus));
