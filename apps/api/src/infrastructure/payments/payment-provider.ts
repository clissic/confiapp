/**
 * Abstracción de pagos (MVP: Mercado Pago Uruguay + MOCK).
 * No inventar endpoints: solo capacidades reales del adapter.
 */

export interface PaymentCheckoutItem {
  title: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
}

export interface CreateCheckoutInput {
  items: PaymentCheckoutItem[];
  externalReference: string;
  payerEmail?: string;
  notificationUrl: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  mockBridgeUrl?: string;
  /**
   * Access token del cobrador (Agente). Si falta, usa la cuenta plataforma.
   * Con marketplaceFeeCents, MP acredita el fee a la app.
   */
  collectorAccessToken?: string;
  /** Fee de marketplace en centavos (va a la cuenta plataforma / sponsor). */
  marketplaceFeeCents?: number;
}

export interface CheckoutResult {
  id: string;
  initPoint: string;
  sandboxInitPoint?: string;
  provider: 'MERCADOPAGO' | 'MOCK';
  raw?: unknown;
}

export interface PaymentLookup {
  id: string;
  status: string;
  statusDetail?: string;
  externalReference?: string;
  transactionAmount?: number;
  currencyId?: string;
  raw?: unknown;
}

export interface WebhookSignatureParams {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
}

export interface RefundResult {
  id: string;
  status: string;
  amountCents?: number;
  raw?: unknown;
}

/** Única vía permitida para ejecutar refunds reales en Mercado Pago. */
export type RefundAuthorization = { via: 'admin_dispute' };

export interface PaymentProvider {
  readonly name: 'MERCADOPAGO' | 'MOCK';
  isMock(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  getPayment(paymentId: string): Promise<PaymentLookup>;
  verifyWebhookSignature(params: WebhookSignatureParams): boolean;
  /**
   * Reembolso live solo con autorización de disputa admin.
   * MOCK simula sin exigir `via`.
   */
  refundPayment(
    paymentId: string,
    amountCents?: number,
    authorization?: RefundAuthorization,
  ): Promise<RefundResult>;
  cancelPayment(paymentId: string): Promise<PaymentLookup>;
}
