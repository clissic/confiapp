import { describe, expect, it, vi } from 'vitest';

import { MercadoPagoPaymentProvider } from '../../infrastructure/payments/mercadopago.payment-provider';

describe('PaymentProvider webhook / refund mock', () => {
  it('MOCK refund es idempotente en forma (mismo paymentId)', async () => {
    const provider = new MercadoPagoPaymentProvider({
      isMock: () => true,
      createPreference: vi.fn(),
      getPayment: vi.fn(),
      verifyWebhookSignature: () => true,
    } as never);

    const a = await provider.refundPayment('MOCK-PAY-1', 1000);
    const b = await provider.refundPayment('MOCK-PAY-1', 1000);
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('approved');
  });

  it('firma webhook delega al client', () => {
    const verify = vi.fn().mockReturnValue(true);
    const provider = new MercadoPagoPaymentProvider({
      isMock: () => true,
      createPreference: vi.fn(),
      getPayment: vi.fn(),
      verifyWebhookSignature: verify,
    } as never);
    expect(
      provider.verifyWebhookSignature({
        xSignature: 'ts=1,v1=abc',
        dataId: '1',
      }),
    ).toBe(true);
    expect(verify).toHaveBeenCalledOnce();
  });
});
