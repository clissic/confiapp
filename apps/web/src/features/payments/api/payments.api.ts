import { computeIntermediationFees } from '@confiapp/shared';

import { apiClient } from '@/shared/api/client';

import {
  ADMIN_TRANSFERS_PAGE_SIZE,
  type EscrowView,
  type ManualPrexTransferDetail,
  type ManualPrexTransferSummary,
  type PaymentEventLog,
  type PaymentRecord,
} from '../model/types';

function hasApiAuth(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function demoEscrow(code: string): EscrowView {
  const productCents = 5_000_000; // $50.000 UYU → comisión $1.000 UYU
  const split = computeIntermediationFees({
    productCents,
    currency: 'UYU',
    feePayer: 'BUYER',
    uyuPerUsd: 40,
  });
  return {
    transactionId: 'demo-tx',
    code: code.toUpperCase() || 'DEMO-001',
    status: 'ACCEPTED',
    currency: 'UYU',
    grossCents: split.buyerPaysCents,
    productCents: split.productCents,
    commissionCents: split.commissionCents,
    feePayer: split.feePayer,
    split,
    parties: {
      buyerId: 'demo-buyer',
      sellerId: 'demo-seller',
      agentId: 'demo-agent',
    },
    providerMode: 'MANUAL_PREX',
    checkoutMode: 'manual_prex',
    amountDueCents: split.buyerPaysCents,
    prexAccount: {
      bank: 'Prex',
      accountName: 'Ignacio La Cava',
      accountNumber: '1065233',
    },
    payments: [],
  };
}

export async function listMyPayments(): Promise<{
  items: PaymentRecord[];
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return { items: [], source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<{ items: PaymentRecord[] }>('/payments');
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: [], source: 'demo' };
  }
}

export async function getEscrow(code: string): Promise<{
  data: EscrowView;
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return { data: demoEscrow(code), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<EscrowView>(
      `/payments/transactions/${encodeURIComponent(code)}`,
    );
    return { data, source: 'api' };
  } catch {
    return { data: demoEscrow(code), source: 'demo' };
  }
}

export async function startCheckout(code: string): Promise<{
  checkoutUrl: string;
  split: EscrowView['split'];
  providerMode: string;
}> {
  if (!hasApiAuth()) {
    return {
      checkoutUrl: '#',
      providerMode: 'MOCK',
      split: demoEscrow(code).split,
    };
  }
  const { data } = await apiClient.post<{
    checkoutUrl: string;
    split: EscrowView['split'];
    providerMode: string;
  }>(`/payments/transactions/${encodeURIComponent(code)}/checkout`);
  return data;
}

export async function submitManualPrexTransfer(
  code: string,
  payload: { receiptDataUrl: string; receiptFileName?: string },
): Promise<{
  transactionCode?: string;
  providerMode: string;
  amountDueCents?: number;
}> {
  if (!hasApiAuth()) {
    return { transactionCode: code.toUpperCase(), providerMode: 'MANUAL_PREX' };
  }
  const { data } = await apiClient.post<{
    transactionCode?: string;
    providerMode: string;
    amountDueCents?: number;
  }>(`/payments/transactions/${encodeURIComponent(code)}/manual-transfer`, payload);
  return data;
}

export async function releaseEscrow(code: string): Promise<unknown> {
  if (!hasApiAuth()) {
    return { ok: true, demo: true };
  }
  const { data } = await apiClient.post(
    `/payments/transactions/${encodeURIComponent(code)}/release`,
  );
  return data;
}

export type MercadoPagoConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'ERROR';

export interface MercadoPagoConnection {
  status: MercadoPagoConnectionStatus;
  connected: boolean;
  oauthConfigured: boolean;
  mpUserId?: string;
  publicNickname?: string;
  email?: string;
  connectedAt?: string;
  lastError?: string;
}

export async function getMercadoPagoConnection(): Promise<{
  data: MercadoPagoConnection;
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return {
      data: {
        status: 'NOT_CONNECTED',
        connected: false,
        oauthConfigured: false,
      },
      source: 'demo',
    };
  }
  try {
    const { data } = await apiClient.get<MercadoPagoConnection>(
      '/payments/mercadopago/connection',
    );
    return { data, source: 'api' };
  } catch {
    return {
      data: {
        status: 'NOT_CONNECTED',
        connected: false,
        oauthConfigured: false,
      },
      source: 'demo',
    };
  }
}

export async function startMercadoPagoOAuth(): Promise<{ authorizationUrl: string }> {
  const { data } = await apiClient.get<{ authorizationUrl: string }>(
    '/payments/mercadopago/oauth/start',
  );
  return data;
}

export async function disconnectMercadoPago(): Promise<{ ok: true }> {
  const { data } = await apiClient.delete<{ ok: true }>('/payments/mercadopago/connection');
  return data;
}

export async function listPaymentLogs(): Promise<{
  items: PaymentEventLog[];
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return {
      items: [
        {
          id: '1',
          source: 'system',
          event: 'demo',
          level: 'info',
          message: 'Sin eventos de pago registrados todavía',
          createdAt: new Date().toISOString(),
        },
      ],
      source: 'demo',
    };
  }
  try {
    const { data } = await apiClient.get<{ items: PaymentEventLog[] }>('/payments/logs');
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: [], source: 'demo' };
  }
}

export async function listManualPrexTransfers(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  items: ManualPrexTransferSummary[];
  checkoutMode: string;
  prexAccount?: { bank?: string; accountName: string; accountNumber: string };
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return {
      checkoutMode: 'manual_prex',
      prexAccount: {
        bank: 'Prex',
        accountName: 'Ignacio La Cava',
        accountNumber: '1065233',
      },
      items: [],
      total: 0,
      page: 1,
      limit: ADMIN_TRANSFERS_PAGE_SIZE,
      totalPages: 0,
      source: 'demo',
    };
  }
  const { data } = await apiClient.get<{
    items: ManualPrexTransferSummary[];
    checkoutMode: string;
    prexAccount?: { bank?: string; accountName: string; accountNumber: string };
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('/payments/admin/manual-transfers', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? ADMIN_TRANSFERS_PAGE_SIZE,
    },
  });
  return { ...data, source: 'api' };
}

export async function getManualPrexTransfer(
  paymentId: string,
): Promise<{ data: ManualPrexTransferDetail; source: 'api' | 'demo' }> {
  if (!hasApiAuth()) {
    throw new Error('No autenticado');
  }
  const { data } = await apiClient.get<ManualPrexTransferDetail>(
    `/payments/admin/manual-transfers/${encodeURIComponent(paymentId)}`,
  );
  return { data, source: 'api' };
}

export async function setManualPrexAdminConfirmation(
  paymentId: string,
  confirmed: boolean,
): Promise<{
  adminConfirmed: boolean;
  transactionCode?: string;
  transactionStatus?: string;
}> {
  const { data } = await apiClient.patch<{
    adminConfirmed: boolean;
    transactionCode?: string;
    transactionStatus?: string;
  }>(`/payments/admin/manual-transfers/${encodeURIComponent(paymentId)}/confirmation`, {
    confirmed,
  });
  return data;
}
