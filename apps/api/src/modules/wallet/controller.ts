import type { Request, Response } from 'express';

import { WalletService } from './service';
import type {
  WalletCommissionsQuery,
  WalletMovementsQuery,
  WalletWithdrawBody,
} from './validation';

export class WalletController {
  constructor(private readonly service = new WalletService()) {}

  summary = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.getSummary(req.user!.id);
    res.status(200).json(data);
  };

  movements = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as WalletMovementsQuery;
    const data = await this.service.listMovements(req.user!.id, {
      limit: query.limit,
      page: query.page,
      type: query.type,
      direction: query.direction,
      transactionCode: query.transactionCode,
      from: query.from,
      to: query.to,
    });
    res.status(200).json(data);
  };

  commissions = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as WalletCommissionsQuery;
    const data = await this.service.listCommissions(req.user!.id, {
      limit: query.limit,
      page: query.page,
      type: query.type,
      transactionCode: query.transactionCode,
      from: query.from,
      to: query.to,
    });
    res.status(200).json(data);
  };

  withdrawals = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.listWithdrawals(req.user!.id);
    res.status(200).json(data);
  };

  requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as WalletWithdrawBody;
    const amountCents = Math.round(body.amount * 100);
    const data = await this.service.requestWithdrawal(req.user!.id, {
      amountCents,
      destinationHint: body.destinationHint,
    });
    res.status(201).json(data);
  };

  completeWithdrawal = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const data = await this.service.completeWithdrawal(req.user!.id, id);
    res.status(200).json(data);
  };

  exportCsv = async (req: Request, res: Response): Promise<void> => {
    const csv = await this.service.exportHistoryCsv(req.user!.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="confiapp-wallet-${req.user!.id.slice(-6)}.csv"`,
    );
    res.status(200).send(csv);
  };
}
