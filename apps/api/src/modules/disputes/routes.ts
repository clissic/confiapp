import { Router } from 'express';

import { asyncHandler } from '../../middleware/async-handler';
import { DisputesController } from './controller';

const controller = new DisputesController();

export const disputesRoutes: Router = Router();

disputesRoutes.get('/status', asyncHandler(controller.getStatus));
