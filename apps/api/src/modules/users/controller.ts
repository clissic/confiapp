import type { Request, Response } from 'express';

import { UsersService } from './service';
import type { RegisterUserBody, UpdateUserBody, UserIdParams } from './validation';

export class UsersController {
  constructor(private readonly service = new UsersService()) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as RegisterUserBody;
    const result = await this.service.register(body);
    res.status(201).json(result);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.getMe(req.user!.id);
    res.status(200).json(user);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as UserIdParams;
    const user = await this.service.getById(id, {
      viewerId: req.user!.id,
      viewerRole: req.user!.role,
    });
    res.status(200).json(user);
  };

  updateById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as UserIdParams;
    const body = req.body as UpdateUserBody;
    const user = await this.service.updateById(
      { id: req.user!.id, role: req.user!.role },
      id,
      body,
    );
    res.status(200).json(user);
  };

  updateMe = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as UpdateUserBody;
    const user = await this.service.updateById(
      { id: req.user!.id, role: req.user!.role },
      req.user!.id,
      body,
    );
    res.status(200).json(user);
  };

  getKycReview = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params as { token: string };
    const data = await this.service.getKycReviewByToken(token);
    res.status(200).json(data);
  };

  decideKycReview = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params as { token: string };
    const body = req.body as { action: 'approve' | 'reject'; reason?: string };
    const data = await this.service.decideKycReview(
      { id: req.user!.id, role: req.user!.role },
      token,
      body,
    );
    res.status(200).json(data);
  };

  requestIdentityChange = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { message: string; attachmentDataUrl?: string };
    const data = await this.service.requestIdentityChange(
      req.user!.id,
      body.message,
      body.attachmentDataUrl,
    );
    res.status(200).json(data);
  };
}
