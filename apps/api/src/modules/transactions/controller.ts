import type { Request, Response } from 'express';

import { env } from '../../shared/config/env';
import { TransactionsService } from './service';
import type {
  AcceptPurchaseBody,
  ConfirmSaleBody,
  CreateSellerTransactionBody,
  CreateTransactionBody,
  FinalizeVerificationBody,
  ToggleChecklistBody,
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

  toggleChecklistItem = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const itemId = String(req.params.itemId);
    const body = req.body as ToggleChecklistBody;
    const data = await this.service.toggleChecklistItem(
      req.user!.id,
      code,
      itemId,
      body.done,
      body.side,
    );
    res.status(200).json(data);
  };

  finalizeVerification = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const body = req.body as FinalizeVerificationBody;
    const data = await this.service.finalizeVerification(req.user!.id, code, body.note);
    res.status(200).json(data);
  };

  buyerAcceptProduct = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.buyerAcceptProduct(req.user!.id, code);
    res.status(200).json(data);
  };

  buyerRejectProduct = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.buyerRejectProduct(req.user!.id, code);
    res.status(200).json(data);
  };

  buyerConfirmArrival = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.buyerConfirmArrival(req.user!.id, code);
    res.status(200).json(data);
  };

  agentConfirmDelivery = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.agentConfirmDelivery(req.user!.id, code);
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
    const body = req.body as AcceptPurchaseBody;
    const data = await this.service.acceptPurchase(req.user!.id, token, body);
    res.status(200).json(data);
  };

  confirmSale = async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token);
    const body = req.body as ConfirmSaleBody;
    const data = await this.service.confirmSale(req.user!.id, token, body);
    res.status(201).json(data);
  };

  buyerConfirm = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.buyerConfirmChanges(req.user!.id, code);
    res.status(200).json(data);
  };

  buyerReject = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.buyerRejectChanges(req.user!.id, code);
    res.status(200).json(data);
  };

  expireDeadlines = async (req: Request, res: Response): Promise<void> => {
    const provided = String(req.headers['x-job-secret'] ?? '');
    const expected = env.TRANSACTIONS_JOB_SECRET;
    const allowed =
      expected.length > 0
        ? provided === expected
        : env.NODE_ENV !== 'production';
    if (!allowed) {
      res.status(401).json({ message: 'Unauthorized job' });
      return;
    }
    const data = await this.service.expireOperationalDeadlines();
    res.status(200).json(data);
  };

  autoCompleteStaleDeliveries = async (req: Request, res: Response): Promise<void> => {
    const provided = String(req.headers['x-job-secret'] ?? '');
    const expected = env.TRANSACTIONS_JOB_SECRET;
    const allowed =
      expected.length > 0
        ? provided === expected
        : env.NODE_ENV !== 'production';
    if (!allowed) {
      res.status(401).json({ message: 'Unauthorized job' });
      return;
    }
    const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 50;
    const data = await this.service.autoCompleteStaleDeliveries(limit);
    res.status(200).json(data);
  };
}
