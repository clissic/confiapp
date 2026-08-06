import { apiClient } from '@/shared/api/client';
import { env } from '@/shared/config/env';

import type {
  WalletCommission,
  WalletMovement,
  WalletSummary,
  WalletWithdrawal,
} from '../model/types';

function hasApiAuth(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function demoSummary(): WalletSummary {
  return {
    status: 'ACTIVE',
    currency: 'USD',
    saldoCents: 375_000_00,
    pendienteCents: 50_000_00,
    retenidoCents: 100_000_00,
    lifetimeEarnedCents: 500_000_00,
    lifetimeSpentCents: 75_000_00,
    lastMovementAt: new Date().toISOString(),
    movementsCount: 4,
    pendingWithdrawalsCount: 1,
    commissionsTotalCents: 100_000_00,
  };
}

export async function fetchWalletSummary(): Promise<{
  data: WalletSummary;
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) return { data: demoSummary(), source: 'demo' };
  try {
    const { data } = await apiClient.get<WalletSummary>('/wallet');
    return { data, source: 'api' };
  } catch {
    return { data: demoSummary(), source: 'demo' };
  }
}

export async function fetchWalletMovements(): Promise<{
  items: WalletMovement[];
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return {
      items: [
        {
          id: '1',
          type: 'ESCROW_RELEASE',
          direction: 'CREDIT',
          amountCents: 375_000_00,
          currency: 'USD',
          description: 'Liberación escrow neto · DEMO-001',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'PLATFORM_FEE',
          direction: 'DEBIT',
          amountCents: 100_000_00,
          currency: 'USD',
          description: 'Comisión plataforma 20% · DEMO-001',
          createdAt: new Date(Date.now() - 3600_000).toISOString(),
        },
        {
          id: '3',
          type: 'WITHDRAWAL_REQUEST',
          direction: 'DEBIT',
          amountCents: 50_000_00,
          currency: 'USD',
          description: 'Solicitud de retiro → Alias MP',
          createdAt: new Date(Date.now() - 7200_000).toISOString(),
        },
      ],
      source: 'demo',
    };
  }
  try {
    const { data } = await apiClient.get<{ items: WalletMovement[] }>('/wallet/movements');
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: [], source: 'demo' };
  }
}

export async function fetchWalletCommissions(): Promise<{
  items: WalletCommission[];
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return {
      items: [
        {
          id: 'c1',
          type: 'PLATFORM_FEE',
          role: 'platform_fee',
          amountCents: 100_000_00,
          currency: 'USD',
          status: 'CAPTURED',
          transactionId: 'demo',
          createdAt: new Date().toISOString(),
          label: 'Comisión de plataforma (20%)',
        },
        {
          id: 'c2',
          type: 'AGENT_PAYOUT',
          role: 'earned',
          amountCents: 25_000_00,
          currency: 'USD',
          status: 'RELEASED',
          transactionId: 'demo',
          createdAt: new Date().toISOString(),
          label: 'Comisión de agente recibida',
        },
      ],
      source: 'demo',
    };
  }
  try {
    const { data } = await apiClient.get<{ items: WalletCommission[] }>('/wallet/commissions');
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: [], source: 'demo' };
  }
}

export async function fetchWalletWithdrawals(): Promise<{
  items: WalletWithdrawal[];
  source: 'api' | 'demo';
}> {
  if (!hasApiAuth()) {
    return {
      items: [
        {
          id: 'w1',
          amountCents: 50_000_00,
          currency: 'USD',
          status: 'PENDING',
          destinationHint: 'Alias MP demo',
          requestedAt: new Date().toISOString(),
        },
      ],
      source: 'demo',
    };
  }
  try {
    const { data } = await apiClient.get<{ items: WalletWithdrawal[] }>('/wallet/withdrawals');
    return { items: data.items ?? [], source: 'api' };
  } catch {
    return { items: [], source: 'demo' };
  }
}

export async function requestWithdrawal(input: {
  amount: number;
  destinationHint?: string;
}): Promise<unknown> {
  if (!hasApiAuth()) {
    return { demo: true };
  }
  const { data } = await apiClient.post('/wallet/withdrawals', input);
  return data;
}

export async function completeWithdrawal(id: string): Promise<unknown> {
  if (!hasApiAuth()) return { demo: true };
  const { data } = await apiClient.post(`/wallet/withdrawals/${id}/complete`);
  return data;
}

/** Descarga CSV del historial (con auth header vía blob fetch). */
export async function exportWalletHistory(): Promise<void> {
  if (!hasApiAuth()) {
    const blob = new Blob(
      ['fecha,tipo,direccion,monto_centavos,moneda,descripcion\n'],
      { type: 'text/csv' },
    );
    triggerDownload(blob, 'confiapp-wallet-demo.csv');
    return;
  }

  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${env.apiUrl}/wallet/export`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/csv',
    },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('No se pudo exportar el historial');
  }
  const blob = await response.blob();
  triggerDownload(blob, 'confiapp-wallet.csv');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
