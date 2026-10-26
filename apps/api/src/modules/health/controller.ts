import type { Request, Response } from 'express';

import { DatabaseModule } from '../../database';

export class HealthController {
  check = async (_req: Request, res: Response): Promise<void> => {
    const isDbConnected = DatabaseModule.isReady();
    const dbReadyState = DatabaseModule.getReadyState();
    const uptime = Math.floor(process.uptime());

    if (!isDbConnected) {
      res.status(503).json({
        status: 'error',
        uptime,
        database: {
          connected: false,
          readyState: dbReadyState,
        },
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      uptime,
      database: {
        connected: true,
        readyState: dbReadyState,
      },
    });
  };
}
