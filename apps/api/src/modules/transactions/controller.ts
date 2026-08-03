import type { Request, Response } from 'express';

import { TransactionsService } from './service';
import type {
  ConfirmSaleBody,
  CreateSellerTransactionBody,
  CreateTransactionBody,
} from './validation';

export class TransactionsController {
  constructor(private readonly service = new TransactionsService()) {}

  getStatus = async (_req: Request, res: Response): Promise<void> => {
    const payload = await this.service.getStatus();
    res.status(200).json(payload);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateTransactionBody;
    const data = await this.service.create(req.user!.id, body);
    res.status(201).json(data);
  };

  createAsSeller = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateSellerTransactionBody;
    const data = await this.service.createAsSeller(req.user!.id, body);
    res.status(201).json(data);
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.listMine(req.user!.id);
    res.status(200).json(data);
  };

  getByCode = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.getByCode(req.user!.id, code);
    res.status(200).json(data);
  };

  refreshInvite = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.refreshInvite(req.user!.id, code);
    res.status(200).json(data);
  };

  previewInvite = async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token);
    const data = await this.service.previewInvite(token);
    res.status(200).json(data);
  };

  joinInvite = async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token);
    const data = await this.service.joinInvite(req.user!.id, token);
    res.status(200).json(data);
  };

  acceptPurchase = async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token);
    const data = await this.service.acceptPurchase(req.user!.id, token);
    res.status(200).json(data);
  };

  confirmSale = async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token);
    const body = req.body as ConfirmSaleBody;
    const data = await this.service.confirmSale(req.user!.id, token, body);
    res.status(201).json(data);
  };
}
