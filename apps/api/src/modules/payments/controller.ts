import type { Request, Response } from 'express';

import { env } from '../../shared/config/env';
import { MercadoPagoOAuthService } from './mercadopago-oauth.service';
import { PaymentsService } from './service';

export class PaymentsController {
  constructor(
    private readonly service = new PaymentsService(),
    private readonly mpOAuth = new MercadoPagoOAuthService(),
  ) {}

  listMine = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.listMine(req.user!.id);
    res.status(200).json(data);
  };

  getEscrow = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.getTransactionEscrow(req.user!.id, code);
    res.status(200).json(data);
  };

  checkout = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.createBuyerCheckout(req.user!.id, code);
    res.status(201).json(data);
  };

  release = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.releaseEscrow(req.user!.id, code);
    res.status(200).json(data);
  };

  mockConfirm = async (req: Request, res: Response): Promise<void> => {
    const paymentId = String(req.params.paymentId);
    const data = await this.service.confirmMockCheckout(paymentId);
    const accept = req.headers.accept ?? '';
    if (accept.includes('text/html') || req.method === 'GET') {
      const code = data.transactionCode;
      if (code) {
        res.redirect(302, `${env.APP_URL}/operaciones/${encodeURIComponent(code)}?pago=ok`);
        return;
      }
      res.redirect(302, `${env.APP_URL}/pagos?status=success`);
      return;
    }
    res.status(200).json(data);
  };

  webhook = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.handleMercadoPagoWebhook({
      query: req.query as Record<string, unknown>,
      body: (req.body ?? {}) as Record<string, unknown>,
      headers: {
        xSignature: req.header('x-signature') ?? undefined,
        xRequestId: req.header('x-request-id') ?? undefined,
      },
    });
    res.status(200).json({ ok: true, ...data });
  };

  listLogs = async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = await this.service.listEventLogs(limit);
    res.status(200).json(data);
  };

  mpConnectionStatus = async (req: Request, res: Response): Promise<void> => {
    const data = await this.mpOAuth.getConnection(req.user!.id);
    res.status(200).json(data);
  };

  mpOAuthStart = async (req: Request, res: Response): Promise<void> => {
    const data = await this.mpOAuth.startOAuth(req.user!.id);
    res.status(200).json(data);
  };

  mpOAuthCallback = async (req: Request, res: Response): Promise<void> => {
    const { redirectUrl } = await this.mpOAuth.handleCallback({
      code: typeof req.query.code === 'string' ? req.query.code : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      error_description:
        typeof req.query.error_description === 'string'
          ? req.query.error_description
          : undefined,
    });
    res.redirect(302, redirectUrl);
  };

  mpDisconnect = async (req: Request, res: Response): Promise<void> => {
    const data = await this.mpOAuth.disconnect(req.user!.id);
    res.status(200).json(data);
  };
}
