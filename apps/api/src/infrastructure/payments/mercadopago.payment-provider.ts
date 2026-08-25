import { env } from '../../shared/config/env';
import { ValidationError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';

import {
  MercadoPagoClient,
  mercadoPagoClient,
} from './mercadopago.client';
import type {
  CreateCheckoutInput,
  CheckoutResult,
  PaymentLookup,
  PaymentProvider,
  RefundResult,
  WebhookSignatureParams,
} from './payment-provider';

/**
 * Adapter PaymentProvider sobre MercadoPagoClient (live o MOCK).
 */
export class MercadoPagoPaymentProvider implements PaymentProvider {
  constructor(private readonly client: MercadoPagoClient = mercadoPagoClient) {}

  get name(): 'MERCADOPAGO' | 'MOCK' {
    return this.client.isMock() ? 'MOCK' : 'MERCADOPAGO';
  }

  isMock(): boolean {
    return this.client.isMock();
  }

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    return this.client.createPreference(input);
  }

  getPayment(paymentId: string): Promise<PaymentLookup> {
    return this.client.getPayment(paymentId);
  }

  verifyWebhookSignature(params: WebhookSignatureParams): boolean {
    return this.client.verifyWebhookSignature(params);
  }

  async refundPayment(paymentId: string, amountCents?: number): Promise<RefundResult> {
    if (this.isMock() || paymentId.startsWith('MOCK-')) {
      logger.info('payment provider mock refund', { paymentId, amountCents });
      return {
        id: `MOCK-REFUND-${paymentId}`,
        status: 'approved',
        amountCents,
        raw: { mock: true },
      };
    }

    if (!env.MERCADOPAGO_ENABLE_REFUNDS) {
      throw new ValidationError(
        'Refunds Mercado Pago no están habilitados en esta cuenta (MERCADOPAGO_ENABLE_REFUNDS).',
      );
    }

    const body: Record<string, unknown> = {};
    if (amountCents != null && amountCents > 0) {
      body.amount = amountCents / 100;
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `refund:${paymentId}:${amountCents ?? 'full'}`,
      },
      body: JSON.stringify(body),
    });
    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      logger.error('mercadopago refund failed', { paymentId, status: response.status, raw });
      throw new Error(
        typeof raw.message === 'string'
          ? raw.message
          : `Mercado Pago refund error (${response.status})`,
      );
    }
    return {
      id: String(raw.id ?? ''),
      status: String(raw.status ?? ''),
      amountCents:
        typeof raw.amount === 'number' ? Math.round(raw.amount * 100) : amountCents,
      raw,
    };
  }

  async cancelPayment(paymentId: string): Promise<PaymentLookup> {
    if (this.isMock() || paymentId.startsWith('MOCK-')) {
      return {
        id: paymentId,
        status: 'cancelled',
        statusDetail: 'mock_cancelled',
      };
    }
    throw new ValidationError(
      'Cancelación de pagos MP no está implementada para esta cuenta en el MVP.',
    );
  }
}

export const paymentProvider: PaymentProvider = new MercadoPagoPaymentProvider();
