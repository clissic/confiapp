export interface EscrowSplit {
  productCents: number;
  commissionCents: number;
  commissionUyu?: number;
  /** @deprecated Alias de commissionUyu */
  commissionUsd?: number;
  buyerPaysCents: number;
  sellerNetCents: number;
  platformFeeCents: number;
  agentFeeCents: number;
  feePayer: string;
  currency?: string;
  /** Alias de buyerPaysCents */
  grossCents: number;
  /** Alias de sellerNetCents */
  sellerCents: number;
  platformCommissionBps?: number;
  agentCommissionBps?: number;
  /** Legacy aliases */
  platformFeeBps?: number;
  agentFeeBps?: number;
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
  /** Total que debe pagar el comprador ahora (incluye tip ConfiAnza si aplica). */
  amountDueCents?: number;
  productCents?: number;
  commissionCents?: number;
  feePayer?: string;
  split: EscrowSplit;
  parties: { buyerId: string; sellerId: string; agentId?: string };
  /** `manual_prex` (MVP) | `mercadopago` (Checkout Pro / MOCK). */
  checkoutMode?: 'manual_prex' | 'mercadopago' | string;
  prexAccount?: {
    bank?: string;
    accountName: string;
    accountNumber: string;
  };
  providerMode: 'MOCK' | 'MERCADOPAGO' | 'MANUAL_PREX' | string;
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

export const ADMIN_TRANSFERS_PAGE_SIZE = 15;

export interface ManualPrexTransferSummary {
  id: string;
  transactionId: string;
  transactionCode?: string;
  transactionTitle?: string;
  transactionStatus?: string;
  status: string;
  amountCents: number;
  currency: string;
  externalId?: string;
  capturedAt?: string;
  createdAt: string;
  buyer: { id: string; email?: string; fullName?: string };
  receiptFileName?: string;
  receiptUploadedAt?: string;
  hasReceipt: boolean;
  adminConfirmed: boolean;
}

export interface ManualPrexTransferDetail {
  payment: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    externalId?: string;
    capturedAt?: string;
    createdAt: string;
    receiptFileName?: string;
    receiptUploadedAt?: string;
    receiptDataUrl?: string;
    prexAccount?: { bank?: string; accountName: string; accountNumber: string };
    adminConfirmed: boolean;
    adminConfirmedAt?: string;
    adminConfirmedBy?: string;
  };
  transaction: {
    id: string;
    code: string;
    title: string;
    status: string;
    currency?: string;
    amountCents?: number;
  } | null;
  buyer: {
    id: string;
    email?: string;
    fullName?: string;
    phone?: string;
  };
}
