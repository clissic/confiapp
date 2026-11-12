import type { Request, Response } from 'express';

import { mediaService } from './service';
import type { ConfirmBody, PresignBody, SignedUrlBody } from './validation';

export class MediaController {
  status = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(mediaService.status());
  };

  presign = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as PresignBody;
    const data = await mediaService.presign(req.user!.id, body);
    res.status(200).json(data);
  };

  confirm = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ConfirmBody;
    const data = await mediaService.confirm(req.user!.id, body);
    res.status(200).json(data);
  };

  signedUrl = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as SignedUrlBody;
    const data = await mediaService.signedUrl(req.user!.id, body.storageKey);
    res.status(200).json(data);
  };
}
