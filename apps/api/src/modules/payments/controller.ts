import type { Request, Response } from 'express';

import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';
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

  syncCheckoutReturn = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.syncCheckoutReturn(req.user!.id, code, {
      mpPaymentId:
        typeof req.body.mpPaymentId === 'string' ? req.body.mpPaymentId : undefined,
      externalReference:
        typeof req.body.externalReference === 'string'
          ? req.body.externalReference
          : undefined,
      status: typeof req.body.status === 'string' ? req.body.status : undefined,
    });
    res.status(200).json(data);
  };

  manualTransfer = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code);
    const data = await this.service.submitManualPrexTransfer(req.user!.id, code, {
      receiptDataUrl: String(req.body.receiptDataUrl),
      receiptFileName:
        typeof req.body.receiptFileName === 'string' ? req.body.receiptFileName : undefined,
    });
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
    try {
      const data = await this.service.handleMercadoPagoWebhook({
        query: req.query as Record<string, unknown>,
        body: (req.body ?? {}) as Record<string, unknown>,
        headers: {
          xSignature: req.header('x-signature') ?? undefined,
          xRequestId: req.header('x-request-id') ?? undefined,
        },
      });
      res.status(200).json({ ok: true, ...data });
    } catch (error) {
      // Nunca 5xx al webhook: MP reintenta y el simulador marca falla.
      // Errores se loguean; no se confirma el pago si falló el flujo.
      logger.error('mercadopago webhook handler error', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(200).json({
        ok: false,
        handled: false,
        reason: 'internal_error',
      });
    }
  };

  listLogs = async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = await this.service.listEventLogs(limit);
    res.status(200).json(data);
  };

  listManualPrexTransfers = async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 15;
    const page = req.query.page ? Number(req.query.page) : 1;
    const data = await this.service.listManualPrexTransfersForAdmin({ page, limit });
    res.status(200).json(data);
  };

  getManualPrexTransfer = async (req: Request, res: Response): Promise<void> => {
    const paymentId = String(req.params.paymentId);
    const data = await this.service.getManualPrexTransferForAdmin(paymentId);
    res.status(200).json(data);
  };

  setManualPrexAdminConfirmation = async (req: Request, res: Response): Promise<void> => {
    const paymentId = String(req.params.paymentId);
    const confirmed = Boolean(req.body.confirmed);
    const data = await this.service.setManualPrexAdminConfirmation(
      req.user!.id,
      paymentId,
      confirmed,
    );
    res.status(200).json(data);
  };

  mpConnectionStatus = async (req: Request, res: Response): Promise<void> => {
    const data = await this.mpOAuth.getConnection(req.user!.id);
    res.status(200).json(data);
  };

  mpOAuthStart = async (req: Request, res: Response): Promise<void> => {
    const data = await this.mpOAuth.startOAuth(req.user!.id);
    try {
      const host = new URL(data.authorizationUrl).host;
      logger.info('mercadopago oauth start', {
        userId: req.user!.id,
        authHost: host,
        redirectUri: env.MERCADOPAGO_OAUTH_REDIRECT_URI,
      });
    } catch {
      /* ignore */
    }
    res.status(200).json(data);
  };

  mpOAuthCallback = async (req: Request, res: Response): Promise<void> => {
    logger.info('mercadopago oauth callback hit', {
      hasCode: typeof req.query.code === 'string' && Boolean(req.query.code),
      hasState: typeof req.query.state === 'string' && Boolean(req.query.state),
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      path: req.originalUrl?.slice(0, 200),
    });
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
