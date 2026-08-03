import type { Request, Response } from 'express';

import { DisputesService } from './service';

export class DisputesController {
  constructor(private readonly service = new DisputesService()) {}

  getStatus = async (_req: Request, res: Response): Promise<void> => {
    const payload = await this.service.getStatus();
    res.status(200).json(payload);
  };
}
