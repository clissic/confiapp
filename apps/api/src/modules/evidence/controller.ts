import type { Request, Response } from 'express';

import { EvidenceService } from './service';

export class EvidenceController {
  constructor(private readonly service = new EvidenceService()) {}

  getStatus = async (_req: Request, res: Response): Promise<void> => {
    const payload = await this.service.getStatus();
    res.status(200).json(payload);
  };
}
