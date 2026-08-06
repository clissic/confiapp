import { apiClient } from '@/shared/api/client';

import type { EscrowView, PaymentEventLog, PaymentRecord } from '../model/types';

function hasApiAuth(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function demoEscrow(code: string): EscrowView {
  const gross = 5_000_000; // $50.000 UYU ejemplo
  const platform = Math.floor((gross * 2000) / 10_000);
  const agent = Math.floor((gross * 500) / 10_000);
  return {
    transactionId: 'demo-tx',
    code: code.toUpperCase() || 'DEMO-001',
    status: 'ACCEPTED',
    currency: 'UYU',
    grossCents: gross,
    split: {
      grossCents: gross,
      platformFeeCents: platform,
      agentFeeCents: agent,
      sellerCents: gross - platform - agent,
      platformFeeBps: 2000,
      agentFeeBps: 500,
    },
    parties: {
      buyerId: 'demo-buyer',
      sellerId: 'demo-seller',
      agentId: 'demo-agent',
    },
    providerMode: 'MOCK',
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

export async function releaseEscrow(code: string): Promise<unknown> {
  if (!hasApiAuth()) {
    return { ok: true, demo: true };
  }
  const { data } = await apiClient.post(
    `/payments/transactions/${encodeURIComponent(code)}/release`,
  );
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
