import type { Request, Response } from 'express';

import { NotificationsService } from './service';
import type { NotificationsListQuery } from './validation';

export class NotificationsController {
  constructor(private readonly service = new NotificationsService()) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as NotificationsListQuery;
    const data = await this.service.listForUser(req.user!.id, {
      limit: query.limit,
      page: query.page,
    });
    res.status(200).json(data);
  };

  unreadCount = async (req: Request, res: Response): Promise<void> => {
    const count = await this.service.unreadCount(req.user!.id);
    res.status(200).json({ count });
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.markRead(req.user!.id, String(req.params.id));
    res.status(200).json(data);
  };

  markAllRead = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.markAllRead(req.user!.id);
    res.status(200).json(data);
  };
}
