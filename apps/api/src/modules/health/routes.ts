import { Router } from 'express';

import { asyncHandler } from '../../middleware';
import { HealthController } from './controller';

const controller = new HealthController();

export const healthRoutes: Router = Router();

healthRoutes.get('/', asyncHandler(controller.check));
