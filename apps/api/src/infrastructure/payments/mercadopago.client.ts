import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';
import { centsToMajorUnit } from '../../modules/payments/split';

export interface MpPreferenceItem {
  title: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
}

export interface MpCreatePreferenceInput {
  items: MpPreferenceItem[];
  externalReference: string;
  payerEmail?: string;
  notificationUrl: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  /**
   * Solo MOCK: URL de la “pasarela” de prueba en la app
   * (p. ej. /operaciones/CODE/pagar/simular?paymentId=…).
   */
  mockBridgeUrl?: string;
}

export interface MpPreferenceResult {
  id: string;
  initPoint: string;
  sandboxInitPoint?: string;
  provider: 'MERCADOPAGO' | 'MOCK';
  raw?: unknown;
}

export interface MpPaymentStatus {
  id: string;
  status: string;
  statusDetail?: string;
  externalReference?: string;
  transactionAmount?: number;
  currencyId?: string;
  raw?: unknown;
}

function hasLiveCredentials(): boolean {
  return Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

/**
 * Cliente Mercado Pago Uruguay (site MLU).
 * Sin access token opera en MOCK para desarrollo local.
 * Docs: https://www.mercadopago.com.uy/developers
 */
export class MercadoPagoClient {
  private readonly baseUrl = 'https://api.mercadopago.com';

  isMock(): boolean {
    return !hasLiveCredentials();
  }

  country(): string {
    return env.MERCADOPAGO_COUNTRY;
  }

  siteId(): string {
    return env.MERCADOPAGO_SITE_ID;
  }

  async createPreference(input: MpCreatePreferenceInput): Promise<MpPreferenceResult> {
    if (this.isMock()) {
      const mockId = `MOCK-PREF-${Date.now()}`;
      const confirmUrl = `${env.API_PUBLIC_URL}/payments/mock/confirm/${encodeURIComponent(input.externalReference)}`;
      const bridgeUrl =
        input.mockBridgeUrl?.trim() ||
        confirmUrl;
      logger.info('mercadopago preference mock created', {
        preferenceId: mockId,
        externalReference: input.externalReference,
        bridgeUrl,
        country: this.country(),
        siteId: this.siteId(),
      });
      return {
        id: mockId,
        initPoint: bridgeUrl,
        sandboxInitPoint: bridgeUrl,
        provider: 'MOCK',
      };
    }

    const body = {
      items: input.items.map((item) => ({
        title: item.title.slice(0, 256),
        quantity: item.quantity,
        unit_price: centsToMajorUnit(item.unitPriceCents),
        currency_id: item.currency,
      })),
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      back_urls: input.backUrls,
      auto_return: 'approved',
      // Cuenta Uruguay / Checkout Pro MLU
      site_id: this.siteId(),
      statement_descriptor: 'ConfiApp UY',
      metadata: {
        source: 'confiapp',
        country: this.country(),
        siteId: this.siteId(),
      },
      ...(input.payerEmail
        ? { payer: { email: input.payerEmail } }
        : {}),
    };

    const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': input.externalReference,
      },
      body: JSON.stringify(body),
    });

    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      logger.error('mercadopago preference failed', {
        status: response.status,
        raw,
        country: this.country(),
      });
      throw new Error(
        typeof raw.message === 'string'
          ? raw.message
          : `Mercado Pago preference error (${response.status})`,
      );
    }

    logger.info('mercadopago preference created', {
      preferenceId: raw.id,
      externalReference: input.externalReference,
      country: this.country(),
      siteId: this.siteId(),
    });

    return {
      id: String(raw.id),
      initPoint: String(raw.init_point ?? ''),
      sandboxInitPoint:
        typeof raw.sandbox_init_point === 'string' ? raw.sandbox_init_point : undefined,
      provider: 'MERCADOPAGO',
      raw,
    };
  }

  async getPayment(paymentId: string): Promise<MpPaymentStatus> {
    if (this.isMock() || paymentId.startsWith('MOCK-')) {
      return {
        id: paymentId,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: paymentId.replace(/^MOCK-PAY-/, ''),
        transactionAmount: 0,
        currencyId: env.PAYMENTS_DEFAULT_CURRENCY,
      };
    }

    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });
    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      logger.error('mercadopago get payment failed', { paymentId, status: response.status, raw });
      throw new Error(`Mercado Pago get payment error (${response.status})`);
    }

    return {
      id: String(raw.id),
      status: String(raw.status ?? ''),
      statusDetail:
        typeof raw.status_detail === 'string' ? raw.status_detail : undefined,
      externalReference:
        typeof raw.external_reference === 'string' ? raw.external_reference : undefined,
      transactionAmount:
        typeof raw.transaction_amount === 'number' ? raw.transaction_amount : undefined,
      currencyId: typeof raw.currency_id === 'string' ? raw.currency_id : undefined,
      raw,
    };
  }

  /**
   * Valida x-signature de webhooks MP cuando hay secret configurado.
   * En MOCK / sin secret, acepta (dev) pero lo registra en logs.
   */
  verifyWebhookSignature(params: {
    xSignature?: string;
    xRequestId?: string;
    dataId?: string;
  }): boolean {
    const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
    if (!secret) {
      if (env.NODE_ENV === 'production') {
        logger.error('mercadopago webhook rejected: missing MERCADOPAGO_WEBHOOK_SECRET');
        return false;
      }
      logger.warn('mercadopago webhook signature skipped (no secret)');
      return true;
    }
    if (!params.xSignature || !params.dataId) {
      logger.warn('mercadopago webhook missing signature headers');
      return false;
    }

    // Formato MP: ts=...,v1=hash
    try {
      const parts = Object.fromEntries(
        params.xSignature.split(',').map((part) => {
          const [k, v] = part.split('=');
          return [k?.trim(), v?.trim()];
        }),
      ) as Record<string, string | undefined>;

      const ts = parts.ts;
      const v1 = parts.v1;
      if (!ts || !v1) return false;

      const manifest = `id:${params.dataId};request-id:${params.xRequestId ?? ''};ts:${ts};`;
      const expected = createHmac('sha256', secret).update(manifest).digest('hex');
      if (v1.length !== expected.length) return false;
      const ok = timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
      if (!ok) logger.warn('mercadopago webhook signature mismatch', { dataId: params.dataId });
      return ok;
    } catch (error) {
      logger.error('mercadopago webhook signature error', { error });
      return false;
    }
  }
}

export const mercadoPagoClient = new MercadoPagoClient();
