import type { Request, Response } from 'express';

import { ChatsService } from './service';
import type { ListMessagesQuery, MarkReadBody, SendMessageBody } from './validation';

export class ChatsController {
  constructor(private readonly service = new ChatsService()) {}

  listMine = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.listMine(req.user!.id);
    res.status(200).json({ items: data });
  };

  listMessages = async (req: Request, res: Response): Promise<void> => {
    const chatId = String(req.params.id);
    const query = req.query as unknown as ListMessagesQuery;
    const data = await this.service.listMessages(req.user!.id, chatId, {
      before: query.before,
      limit: query.limit,
    });
    res.status(200).json({ items: data });
  };

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    const chatId = String(req.params.id);
    const body = req.body as SendMessageBody;
    const data = await this.service.sendMessage(req.user!.id, chatId, {
      body: body.body,
      attachments: body.attachments,
    });
    res.status(201).json(data);
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    const chatId = String(req.params.id);
    const body = req.body as MarkReadBody;
    const data = await this.service.markRead(req.user!.id, chatId, body.messageIds);
    res.status(200).json(data);
  };
}
