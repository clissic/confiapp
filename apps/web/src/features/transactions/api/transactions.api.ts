import { apiClient } from '@/shared/api/client';

import type {
  ConfirmSalePayload,
  CreateSellerTransactionPayload,
  CreateTransactionPayload,
  InvitePreview,
  Transaction,
} from '../model/types';

const DEMO_KEY = 'confiapp.transactions.demo';

function hasAccessToken(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

function normalizeDemoChecklist(
  checklist: Transaction['conditions']['checklist'] | string[] | undefined,
): Transaction['conditions']['checklist'] {
  if (!checklist?.length) return undefined;
  return checklist.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `legacy-${index}`, text: item, done: false };
    }
    return item;
  });
}

function loadDemoList(): Transaction[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Transaction[];
    return list.map((tx) => ({
      ...tx,
      initiatedBy: tx.initiatedBy ?? 'BUYER',
      conditions: {
        ...tx.conditions,
        checklist: normalizeDemoChecklist(
          tx.conditions?.checklist as Transaction['conditions']['checklist'] | string[],
        ),
      },
    }));
  } catch {
    return [];
  }
}

function saveDemoList(list: Transaction[]): Transaction[] {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  return list;
}

function demoCode(): string {
  const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `CONF-${hex}`;
}

function createDemoChecklist(texts?: string[]) {
  if (!texts?.length) return undefined;
  return texts.map((text, index) => ({
    id: `demo-ck-${Date.now()}-${index}`,
    text,
    done: false,
  }));
}

function createDemoTransaction(payload: CreateTransactionPayload): Transaction {
  const now = new Date().toISOString();
  const days = payload.inviteExpiresInDays ?? 7;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const code = demoCode();
  const token = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const shareUrl = `${window.location.origin}/operaciones/unirse/${token}`;

  return {
    id: `demo-${Date.now()}`,
    code,
    title: payload.title,
    description: payload.description,
    createdBy: 'demo-user',
    initiatedBy: 'BUYER',
    status: 'WAITING_PARTICIPANT',
    conditions: {
      summary: payload.conditionsSummary,
      checklist: createDemoChecklist(payload.checklist),
    },
    amountCents: Math.round(payload.amount * 100),
    currency: payload.currency ?? 'UYU',
    participants: [
      {
        userId: 'demo-user',
        role: 'CREATOR',
        status: 'ACCEPTED',
        invitedAt: now,
        respondedAt: now,
      },
    ],
    statusHistory: [
      {
        status: 'CREATED',
        changedAt: now,
        note: 'Operación iniciada por el comprador',
      },
      {
        status: 'WAITING_PARTICIPANT',
        changedAt: now,
        note: 'Enlace de invitación generado — esperando contraparte',
      },
    ],
    invite: {
      shareUrl,
      expiresAt: expires,
      isExpired: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createDemoSellerTransaction(
  payload: CreateSellerTransactionPayload,
): Transaction {
  const now = new Date().toISOString();
  const days = payload.inviteExpiresInDays ?? 7;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const code = demoCode();
  const token = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const shareUrl = `${window.location.origin}/operaciones/unirse/${token}`;
  const amountCents = Math.round(payload.product.price * 100);
  const currency = payload.product.currency ?? 'UYU';
  const productId = `demo-product-${Date.now()}`;

  return {
    id: `demo-${Date.now()}`,
    code,
    title: payload.title,
    description: payload.description,
    createdBy: 'demo-seller',
    initiatedBy: 'SELLER',
    status: 'WAITING_PARTICIPANT',
    conditions: {
      summary: payload.conditionsSummary,
      checklist: createDemoChecklist(payload.checklist),
    },
    amountCents,
    currency,
    productId,
    product: {
      id: productId,
      title: payload.product.title,
      description: payload.product.description,
      condition: payload.product.condition,
      category: payload.product.category ?? 'OTHER',
      status: 'IN_TRANSACTION',
      estimatedValueCents: amountCents,
      currency,
      images: payload.product.images.map((img, index) => ({
        url: img.url,
        alt: img.alt,
        sortOrder: index,
      })),
    },
    participants: [
      {
        userId: 'demo-seller',
        role: 'CREATOR',
        status: 'ACCEPTED',
        invitedAt: now,
        respondedAt: now,
      },
    ],
    statusHistory: [
      {
        status: 'CREATED',
        changedAt: now,
        note: 'Operación iniciada por el vendedor',
      },
      {
        status: 'WAITING_PARTICIPANT',
        changedAt: now,
        note: 'Enlace generado para el comprador — esperando aceptación',
      },
    ],
    invite: {
      shareUrl,
      expiresAt: expires,
      isExpired: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export { formatMoney } from '@/shared/lib/money';

export async function listTransactions(): Promise<{
  data: Transaction[];
  source: 'api' | 'demo';
}> {
  if (!hasAccessToken()) {
    return { data: loadDemoList(), source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<Transaction[]>('/transactions');
    return { data, source: 'api' };
  } catch {
    return { data: loadDemoList(), source: 'demo' };
  }
}

export async function createTransaction(
  payload: CreateTransactionPayload,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const created = createDemoTransaction(payload);
    const list = loadDemoList();
    saveDemoList([created, ...list]);
    return { data: created, source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<Transaction>('/transactions', payload);
    return { data, source: 'api' };
  } catch {
    const created = createDemoTransaction(payload);
    const list = loadDemoList();
    saveDemoList([created, ...list]);
    return { data: created, source: 'demo' };
  }
}

export async function createSellerTransaction(
  payload: CreateSellerTransactionPayload,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const created = createDemoSellerTransaction(payload);
    const list = loadDemoList();
    saveDemoList([created, ...list]);
    return { data: created, source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<Transaction>('/transactions/as-seller', payload);
    return { data, source: 'api' };
  } catch {
    const created = createDemoSellerTransaction(payload);
    const list = loadDemoList();
    saveDemoList([created, ...list]);
    return { data: created, source: 'demo' };
  }
}

export async function getTransactionByCode(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const found = loadDemoList().find((tx) => tx.code === code.toUpperCase());
    if (!found) throw new Error('Operación no encontrada');
    return { data: found, source: 'demo' };
  }
  try {
    const { data } = await apiClient.get<Transaction>(`/transactions/by-code/${code}`);
    return { data, source: 'api' };
  } catch {
    const found = loadDemoList().find((tx) => tx.code === code.toUpperCase());
    if (!found) throw new Error('Operación no encontrada');
    return { data: found, source: 'demo' };
  }
}

export async function toggleChecklistItem(
  code: string,
  itemId: string,
  done: boolean,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    const checklist = (tx.conditions.checklist ?? []).map((item) =>
      item.id === itemId
        ? {
            ...item,
            done,
            doneAt: done ? new Date().toISOString() : undefined,
          }
        : item,
    );
    const updated: Transaction = {
      ...tx,
      conditions: { ...tx.conditions, checklist },
      updatedAt: new Date().toISOString(),
    };
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.patch<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/checklist/${encodeURIComponent(itemId)}`,
    { done },
  );
  return { data, source: 'api' };
}

export async function refreshInviteLink(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  const patchDemo = (): Transaction => {
    const list = loadDemoList();
    const current = list.find((tx) => tx.code === code.toUpperCase());
    if (!current) throw new Error('Operación no encontrada');
    const token = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const shareUrl = `${window.location.origin}/operaciones/unirse/${token}`;
    const updated: Transaction = {
      ...current,
      invite: {
        shareUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isExpired: false,
      },
      updatedAt: new Date().toISOString(),
    };
    saveDemoList(list.map((tx) => (tx.code === updated.code ? updated : tx)));
    return updated;
  };

  if (!hasAccessToken()) {
    return { data: patchDemo(), source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<Transaction>(
      `/transactions/by-code/${code}/invite/refresh`,
    );
    return { data, source: 'api' };
  } catch {
    return { data: patchDemo(), source: 'demo' };
  }
}

function demoInvitePreview(token: string): InvitePreview | null {
  const found = loadDemoList().find((tx) => tx.invite.shareUrl?.includes(token));
  if (!found) return null;
  return {
    code: found.code,
    title: found.title,
    description: found.description,
    amountCents: found.amountCents,
    currency: found.currency,
    conditionsSummary: found.conditions.summary,
    status: found.status,
    initiatedBy: found.initiatedBy ?? 'BUYER',
    inviteExpiresAt: found.invite.expiresAt,
    isExpired: found.invite.isExpired,
    creatorName:
      found.initiatedBy === 'SELLER' ? 'Vendedor demo' : 'Comprador demo',
    hasProduct: Boolean(found.product),
    hasCounterparty: found.participants.some((p) => p.role === 'COUNTERPARTY'),
    product: found.product,
  };
}

export async function previewInvite(
  token: string,
): Promise<{ data: InvitePreview; source: 'api' | 'demo' }> {
  try {
    const { data } = await apiClient.get<InvitePreview>(`/transactions/invite/${token}`);
    return { data, source: 'api' };
  } catch {
    const demo = demoInvitePreview(token);
    if (!demo) throw new Error('Enlace inválido');
    return { data: demo, source: 'demo' };
  }
}

function applyAcceptPurchaseDemo(token: string): Transaction {
  const list = loadDemoList();
  const current = list.find((item) => item.invite.shareUrl?.includes(token));
  if (!current) throw new Error('Enlace inválido');
  if (current.invite.isExpired) throw new Error('El enlace expiró');
  if (current.initiatedBy !== 'SELLER') {
    throw new Error('Solo se puede aceptar la compra en operaciones iniciadas por el vendedor');
  }
  if (!current.product) throw new Error('La operación no tiene un producto para aceptar');
  if (current.status === 'ACCEPTED') return current;

  const now = new Date().toISOString();
  const hasCounter = current.participants.some((p) => p.role === 'COUNTERPARTY');
  const updated: Transaction = {
    ...current,
    status: 'ACCEPTED',
    participants: hasCounter
      ? current.participants
      : [
          ...current.participants,
          {
            userId: 'demo-buyer',
            role: 'COUNTERPARTY',
            status: 'ACCEPTED',
            invitedAt: now,
            respondedAt: now,
          },
        ],
    statusHistory: [
      ...current.statusHistory,
      {
        status: 'ACCEPTED',
        changedAt: now,
        note: 'Comprador aceptó la compra — acuerdo cerrado, pendiente de fondeo',
      },
    ],
    updatedAt: now,
  };
  saveDemoList(list.map((item) => (item.code === updated.code ? updated : item)));
  return updated;
}

export async function joinInvite(
  token: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const current = list.find((item) => item.invite.shareUrl?.includes(token));
    if (!current) throw new Error('Enlace inválido');
    if (current.initiatedBy === 'SELLER') {
      return { data: applyAcceptPurchaseDemo(token), source: 'demo' };
    }
    if (current.invite.isExpired) throw new Error('El enlace expiró');
    const hasCounter = current.participants.some((p) => p.role === 'COUNTERPARTY');
    if (!hasCounter) {
      const now = new Date().toISOString();
      const updated: Transaction = {
        ...current,
        participants: [
          ...current.participants,
          {
            userId: 'demo-counterparty',
            role: 'COUNTERPARTY',
            status: 'ACCEPTED',
            invitedAt: now,
            respondedAt: now,
          },
        ],
        statusHistory: [
          ...current.statusHistory,
          {
            status: current.status,
            changedAt: now,
            note: 'Contraparte se unió mediante enlace de invitación',
          },
        ],
        updatedAt: now,
      };
      saveDemoList(list.map((item) => (item.code === updated.code ? updated : item)));
      return { data: updated, source: 'demo' };
    }
    return { data: current, source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<Transaction>(`/transactions/invite/${token}/join`);
    return { data, source: 'api' };
  } catch (error) {
    throw error instanceof Error ? error : new Error('No se pudo unir a la operación');
  }
}

export async function acceptPurchase(
  token: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return { data: applyAcceptPurchaseDemo(token), source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<Transaction>(
      `/transactions/invite/${token}/accept-purchase`,
    );
    return { data, source: 'api' };
  } catch {
    return { data: applyAcceptPurchaseDemo(token), source: 'demo' };
  }
}

function applyConfirmSaleDemo(
  token: string,
  payload: ConfirmSalePayload,
): Transaction {
  const list = loadDemoList();
  const current = list.find((item) => item.invite.shareUrl?.includes(token));
  if (!current) throw new Error('Enlace inválido');
  if (current.invite.isExpired) throw new Error('El enlace expiró');
  if (current.product) throw new Error('Esta operación ya tiene un producto confirmado');

  const now = new Date().toISOString();
  const amountCents = Math.round(payload.price * 100);
  const currency = payload.currency ?? current.currency ?? 'UYU';
  const hasCounter = current.participants.some((p) => p.role === 'COUNTERPARTY');

  const product = {
    id: `demo-product-${Date.now()}`,
    title: payload.title,
    description: payload.description,
    condition: payload.condition,
    category: payload.category ?? ('OTHER' as const),
    status: 'IN_TRANSACTION' as const,
    estimatedValueCents: amountCents,
    currency,
    images: payload.images.map((img, index) => ({
      url: img.url,
      alt: img.alt,
      sortOrder: index,
    })),
  };

  const updated: Transaction = {
    ...current,
    status: 'ACCEPTED',
    amountCents,
    currency,
    productId: product.id,
    product,
    participants: hasCounter
      ? current.participants
      : [
          ...current.participants,
          {
            userId: 'demo-seller',
            role: 'COUNTERPARTY',
            status: 'ACCEPTED',
            invitedAt: now,
            respondedAt: now,
          },
        ],
    statusHistory: [
      ...current.statusHistory,
      {
        status: 'ACCEPTED',
        changedAt: now,
        note: 'Vendedor confirmó la venta — acuerdo cerrado, pendiente de fondeo',
      },
    ],
    updatedAt: now,
  };

  saveDemoList(list.map((item) => (item.code === updated.code ? updated : item)));
  return updated;
}

export async function confirmSale(
  token: string,
  payload: ConfirmSalePayload,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return { data: applyConfirmSaleDemo(token, payload), source: 'demo' };
  }
  try {
    const { data } = await apiClient.post<Transaction>(
      `/transactions/invite/${token}/confirm-sale`,
      payload,
    );
    return { data, source: 'api' };
  } catch {
    return { data: applyConfirmSaleDemo(token, payload), source: 'demo' };
  }
}
