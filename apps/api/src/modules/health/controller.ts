import type { Request, Response } from 'express';

import { HealthService } from './service';

export class HealthController {
  constructor(private readonly service = new HealthService()) {}

  getHealth = async (_req: Request, res: Response): Promise<void> => {
    const payload = await this.service.getHealth();
    res.status(200).json(payload);
  };
}
