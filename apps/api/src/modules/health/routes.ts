import { Router } from 'express';

import { asyncHandler } from '../../middleware/async-handler';
import { HealthController } from './controller';

const controller = new HealthController();

export const healthRoutes: Router = Router();

healthRoutes.get('/', asyncHandler(controller.getHealth));
