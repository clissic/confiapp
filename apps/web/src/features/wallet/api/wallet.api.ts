import { apiClient } from '@/shared/api/client';
import { env } from '@/shared/config/env';

import type {
  WalletCommission,
  WalletCommissionsPage,
  WalletCommissionsQuery,
  WalletMovement,
  WalletMovementsPage,
  WalletMovementsQuery,
  WalletSummary,
  WalletWithdrawal,
} from '../model/types';

function hasApiAuth(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function demoSummary(): WalletSummary {
  return {
    status: 'ACTIVE',
    currency: 'UYU',
    saldoCents: 375_000_00,
    pendienteCents: 50_000_00,
    retenidoCents: 100_000_00,
    lifetimeEarnedCents: 500_000_00,
    lifetimeSpentCents: 75_000_00,
    lastMovementAt: new Date().toISOString(),
    movementsCount: 4,
    pendingWithdrawalsCount: 1,
    commissionsTotalCents: 100_000_00,
    salesWithdrawableCents: 375_000_00,
    agentSelfServiceWithdrawalsEnabled: true,
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

export async function fetchWalletMovements(
  query: WalletMovementsQuery = {},
): Promise<WalletMovementsPage & { source: 'api' | 'demo' }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  if (!hasApiAuth()) {
    const demoItems: WalletMovement[] = [
      {
        id: '1',
        type: 'ESCROW_RELEASE',
        direction: 'CREDIT',
        amountCents: 375_000_00,
        currency: 'UYU',
        description: 'Liberación escrow neto · DEMO-001',
        transactionCode: 'DEMO-001',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'PLATFORM_FEE',
        direction: 'DEBIT',
        amountCents: 100_000_00,
        currency: 'UYU',
        description: 'Comisión plataforma 20% · DEMO-001',
        transactionCode: 'DEMO-001',
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
      },
      {
        id: '3',
        type: 'WITHDRAWAL_REQUEST',
        direction: 'DEBIT',
        amountCents: 50_000_00,
        currency: 'UYU',
        description: 'Solicitud de retiro → Alias MP',
        createdAt: new Date(Date.now() - 7200_000).toISOString(),
      },
      {
        id: '4',
        type: 'AGENT_PAYOUT',
        direction: 'CREDIT',
        amountCents: 25_000_00,
        currency: 'UYU',
        description: 'Comisión de intermediación · DEMO-001',
        transactionCode: 'DEMO-001',
        createdAt: new Date(Date.now() - 10_800_000).toISOString(),
      },
    ];

    let filtered = demoItems;
    if (query.type) filtered = filtered.filter((m) => m.type === query.type);
    if (query.direction) filtered = filtered.filter((m) => m.direction === query.direction);
    if (query.transactionCode?.trim()) {
      const code = query.transactionCode.trim().toUpperCase();
      filtered = filtered.filter((m) => m.transactionCode?.toUpperCase() === code);
    }

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages,
      source: 'demo',
    };
  }

  try {
    const { data } = await apiClient.get<WalletMovementsPage>('/wallet/movements', {
      params: {
        page,
        limit,
        type: query.type || undefined,
        direction: query.direction || undefined,
        transactionCode: query.transactionCode?.trim() || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
      },
    });
    return {
      items: data.items ?? [],
      total: data.total ?? 0,
      page: data.page ?? page,
      limit: data.limit ?? limit,
      totalPages: data.totalPages ?? 0,
      source: 'api',
    };
  } catch {
    return { items: [], total: 0, page, limit, totalPages: 0, source: 'demo' };
  }
}

export async function fetchWalletCommissions(
  query: WalletCommissionsQuery = {},
): Promise<WalletCommissionsPage & { source: 'api' | 'demo' }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  if (!hasApiAuth()) {
    const demoItems: WalletCommission[] = [
      {
        id: 'c1',
        type: 'PLATFORM_FEE',
        role: 'platform_fee',
        amountCents: 100_000_00,
        currency: 'UYU',
        status: 'CAPTURED',
        transactionId: 'demo',
        transactionCode: 'DEMO-001',
        createdAt: new Date().toISOString(),
        label: 'Comisión de plataforma',
      },
      {
        id: 'c2',
        type: 'AGENT_PAYOUT',
        role: 'earned',
        amountCents: 25_000_00,
        currency: 'UYU',
        status: 'RELEASED',
        transactionId: 'demo',
        transactionCode: 'DEMO-001',
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        label: 'Comisión de agente recibida',
      },
    ];

    let filtered = demoItems;
    if (query.type) filtered = filtered.filter((c) => c.type === query.type);
    if (query.transactionCode?.trim()) {
      const code = query.transactionCode.trim().toUpperCase();
      filtered = filtered.filter((c) => c.transactionCode?.toUpperCase() === code);
    }

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages,
      source: 'demo',
    };
  }

  try {
    const { data } = await apiClient.get<WalletCommissionsPage>('/wallet/commissions', {
      params: {
        page,
        limit,
        type: query.type || undefined,
        transactionCode: query.transactionCode?.trim() || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
      },
    });
    return {
      items: data.items ?? [],
      total: data.total ?? 0,
      page: data.page ?? page,
      limit: data.limit ?? limit,
      totalPages: data.totalPages ?? 0,
      source: 'api',
    };
  } catch {
    return { items: [], total: 0, page, limit, totalPages: 0, source: 'demo' };
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
          currency: 'UYU',
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
