export interface EscrowSplit {
  grossCents: number;
  platformFeeCents: number;
  agentFeeCents: number;
  sellerCents: number;
  platformFeeBps: number;
  agentFeeBps: number;
}

export interface PaymentRecord {
  id: string;
  transactionId: string;
  payerId: string;
  payeeId?: string;
  type: string;
  status: string;
  provider: string;
  amountCents: number;
  currency: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  capturedAt?: string;
  releasedAt?: string;
}

export interface EscrowView {
  transactionId: string;
  code: string;
  status: string;
  currency: string;
  country?: string;
  siteId?: string;
  grossCents: number;
  split: EscrowSplit;
  parties: { buyerId: string; sellerId: string; agentId?: string };
  providerMode: 'MOCK' | 'MERCADOPAGO' | string;
  payments: PaymentRecord[];
}

export interface PaymentEventLog {
  id: string;
  source: string;
  event: string;
  level: string;
  message: string;
  transactionId?: string;
  paymentId?: string;
  externalId?: string;
  createdAt: string;
}
