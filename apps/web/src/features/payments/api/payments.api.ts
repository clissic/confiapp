import { AGENT_FEE_ONLY_UYU_CENTS } from '@confiapp/shared';

import { apiClient } from '@/shared/api/client';

import {
  type EscrowView,
  type PaymentEventLog,
  type PaymentRecord,
} from '../model/types';

function hasApiAuth(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

/** Demo alineado al modo vigente: solo contratación del Agente. */
function demoEscrow(code: string): EscrowView {
  const buyerPays = AGENT_FEE_ONLY_UYU_CENTS;
  const platformFeeCents = Math.floor((buyerPays * 2_000) / 10_000);
  const agentFeeCents = buyerPays - platformFeeCents;
  const split = {
    productCents: 0,
    commissionCents: buyerPays,
    buyerPaysCents: buyerPays,
    sellerNetCents: 0,
    platformFeeCents,
    agentFeeCents,
    feePayer: 'BUYER',
    currency: 'UYU' as const,
    grossCents: buyerPays,
    sellerCents: 0,
    platformCommissionBps: 2_000,
    agentCommissionBps: 8_000,
  };
  return {
    transactionId: 'demo-tx',
    code: code.toUpperCase() || 'DEMO-001',
    status: 'ACCEPTED',
    currency: 'UYU',
    grossCents: buyerPays,
    productCents: 0,
    commissionCents: buyerPays,
    feePayer: 'BUYER',
    split,
    parties: {
      buyerId: 'demo-buyer',
      sellerId: 'demo-seller',
      agentId: 'demo-agent',
    },
    providerMode: 'MOCK',
    checkoutMode: 'mercadopago',
    amountDueCents: buyerPays,
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

/** Confirma el pago al volver de Mercado Pago (si el webhook no alcanzó la API). */
export async function syncCheckoutReturn(
  code: string,
  input: {
    mpPaymentId?: string;
    externalReference?: string;
    status?: string;
  },
): Promise<{ confirmed: boolean; alreadyConfirmed?: boolean; reason?: string }> {
  if (!hasApiAuth()) {
    return { confirmed: false, reason: 'no_auth' };
  }
  const { data } = await apiClient.post<{
    confirmed: boolean;
    alreadyConfirmed?: boolean;
    reason?: string;
  }>(`/payments/transactions/${encodeURIComponent(code)}/sync-checkout`, input);
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

