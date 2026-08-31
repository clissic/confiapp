import { apiClient } from '@/shared/api/client';

import type {
  AcceptPurchasePayload,
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
  const checklist = createDemoChecklist(payload.checklist);
  const meetingLocation =
    payload.meetingLocationMode === 'CHAT' ? undefined : payload.meetingLocation;

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
      checklist,
    },
    amountCents: Math.round(payload.amount * 100),
    currency: payload.currency ?? 'UYU',
    feePayer: payload.feePayer,
    confiAnzaCents:
      payload.confiAnzaAmount && payload.confiAnzaAmount > 0
        ? Math.round(payload.confiAnzaAmount * 100)
        : undefined,
    confiAnzaCurrency:
      payload.confiAnzaAmount && payload.confiAnzaAmount > 0
        ? payload.confiAnzaCurrency ?? payload.currency ?? 'UYU'
        : undefined,
    meetingLocation,
    party: {
      buyer: {
        conditionsSummary: payload.conditionsSummary,
        checklist,
        meetingLocation,
        productTitle: payload.productTitle,
        productDescription: payload.productDescription,
      },
    },
    viewerRole: 'BUYER',
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
  const checklist = createDemoChecklist(payload.checklist);
  const meetingLocation =
    payload.meetingLocationMode === 'CHAT' ? undefined : payload.meetingLocation;

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
      checklist,
    },
    amountCents,
    currency,
    feePayer: payload.feePayer,
    confiAnzaCents:
      payload.confiAnzaAmount && payload.confiAnzaAmount > 0
        ? Math.round(payload.confiAnzaAmount * 100)
        : undefined,
    confiAnzaCurrency:
      payload.confiAnzaAmount && payload.confiAnzaAmount > 0
        ? payload.confiAnzaCurrency ?? currency
        : undefined,
    meetingLocation,
    party: {
      seller: {
        conditionsSummary: payload.conditionsSummary,
        checklist,
        meetingLocation,
        productTitle: payload.product.title,
        productDescription: payload.product.description,
      },
    },
    returnInstructions: payload.returnInstructions,
    viewerRole: 'SELLER',
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

export { formatMoney, formatOperationMoney } from '@/shared/lib/money';

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
  const { data } = await apiClient.post<Transaction>('/transactions', payload);
  return { data, source: 'api' };
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
  const { data } = await apiClient.post<Transaction>('/transactions/as-seller', payload);
  return { data, source: 'api' };
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
  side?: 'buyer' | 'seller',
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    const patchSide = (
      items: NonNullable<Transaction['conditions']['checklist']> | undefined,
    ) =>
      (items ?? []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              done,
              doneAt: done ? new Date().toISOString() : undefined,
            }
          : item,
      );

    let updated: Transaction = { ...tx, updatedAt: new Date().toISOString() };
    if (side === 'buyer' && tx.party?.buyer) {
      updated = {
        ...updated,
        party: {
          ...tx.party,
          buyer: { ...tx.party.buyer, checklist: patchSide(tx.party.buyer.checklist) },
        },
      };
    } else if (side === 'seller' && tx.party?.seller) {
      updated = {
        ...updated,
        party: {
          ...tx.party,
          seller: { ...tx.party.seller, checklist: patchSide(tx.party.seller.checklist) },
        },
      };
    } else {
      updated = {
        ...updated,
        conditions: { ...tx.conditions, checklist: patchSide(tx.conditions.checklist) },
      };
    }
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.patch<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/checklist/${encodeURIComponent(itemId)}`,
    { done, ...(side ? { side } : {}) },
  );
  return { data, source: 'api' };
}

export async function finalizeAgentVerification(
  code: string,
  note?: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    const buyerItems = tx.party?.buyer?.checklist ?? [];
    const sellerItems = tx.party?.seller?.checklist ?? [];
    const items =
      buyerItems.length || sellerItems.length
        ? [...buyerItems, ...sellerItems]
        : (tx.conditions.checklist ?? []);
    if (!items.length) throw new Error('No hay checklist para verificar');
    const allPassed = items.every((item) => item.done);
    const trimmedNote = note?.trim() || undefined;
    const updated: Transaction = {
      ...tx,
      agentVerification: {
        allPassed,
        completedAt: new Date().toISOString(),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      },
      statusHistory: [
        ...tx.statusHistory,
        {
          status: tx.status,
          changedAt: new Date().toISOString(),
          note: allPassed
            ? 'Agente finalizó la verificación: todos los pasos correctos'
            : 'Agente finalizó la verificación: faltan pasos o no todos fueron aprobados',
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/verification/finalize`,
    { ...(note?.trim() ? { note: note.trim() } : {}) },
  );
  return { data, source: 'api' };
}

export async function buyerAcceptProduct(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    if (!tx.agentVerification) throw new Error('Todavía no hay verificación del Agente');
    if (tx.agentVerification.buyerDecision) throw new Error('Ya registraste tu decisión');
    const now = new Date().toISOString();
    const updated: Transaction = {
      ...tx,
      status: 'IN_PROGRESS',
      agentVerification: {
        ...tx.agentVerification,
        buyerDecision: 'ACCEPTED',
        buyerDecidedAt: now,
      },
      statusHistory: [
        ...tx.statusHistory,
        {
          status: 'IN_PROGRESS',
          changedAt: now,
          note: 'Comprador aceptó el producto tras la verificación; el Agente inicia la entrega',
        },
      ],
      updatedAt: now,
    };
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/product/accept`,
  );
  return { data, source: 'api' };
}

export async function buyerRejectProduct(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    if (!tx.agentVerification) throw new Error('Todavía no hay verificación del Agente');
    if (tx.agentVerification.buyerDecision) throw new Error('Ya registraste tu decisión');
    const now = new Date().toISOString();
    const updated: Transaction = {
      ...tx,
      status: 'CANCELLED',
      agentVerification: {
        ...tx.agentVerification,
        buyerDecision: 'REJECTED',
        buyerDecidedAt: now,
      },
      statusHistory: [
        ...tx.statusHistory,
        {
          status: 'CANCELLED',
          changedAt: now,
          note: 'Comprador rechazó el producto y canceló la compra',
        },
      ],
      updatedAt: now,
    };
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/product/reject`,
  );
  return { data, source: 'api' };
}

function demoCompleteIfBoth(
  tx: Transaction,
  now: string,
): Transaction {
  const buyerOk = Boolean(tx.deliveryConfirmation?.buyerArrivalConfirmedAt);
  const agentOk = Boolean(tx.deliveryConfirmation?.agentDeliveryConfirmedAt);
  if (!buyerOk || !agentOk) return tx;
  return {
    ...tx,
    status: 'COMPLETED',
    statusHistory: [
      ...tx.statusHistory,
      {
        status: 'COMPLETED',
        changedAt: now,
        note: 'Fondos liberados tras confirmación de arribo y entrega',
      },
    ],
    updatedAt: now,
  };
}

export async function buyerConfirmArrival(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    if (tx.agentVerification?.buyerDecision !== 'ACCEPTED') {
      throw new Error('Primero tenés que aceptar el producto');
    }
    if (tx.deliveryConfirmation?.buyerArrivalConfirmedAt) {
      throw new Error('Ya confirmaste el arribo');
    }
    const now = new Date().toISOString();
    let updated: Transaction = {
      ...tx,
      status: 'IN_PROGRESS',
      deliveryConfirmation: {
        ...tx.deliveryConfirmation,
        buyerArrivalConfirmedAt: now,
      },
      statusHistory: [
        ...tx.statusHistory,
        {
          status: 'IN_PROGRESS',
          changedAt: now,
          note: 'Comprador confirmó el arribo del producto',
        },
      ],
      updatedAt: now,
    };
    updated = demoCompleteIfBoth(updated, now);
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/delivery/confirm-arrival`,
    undefined,
    { timeout: 60_000 },
  );
  return { data, source: 'api' };
}

export async function agentConfirmDelivery(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const tx = list[index]!;
    if (tx.agentVerification?.buyerDecision !== 'ACCEPTED') {
      throw new Error('El comprador todavía no aceptó el producto');
    }
    if (tx.deliveryConfirmation?.agentDeliveryConfirmedAt) {
      throw new Error('Ya confirmaste la entrega');
    }
    const now = new Date().toISOString();
    let updated: Transaction = {
      ...tx,
      status: 'IN_PROGRESS',
      deliveryConfirmation: {
        ...tx.deliveryConfirmation,
        agentDeliveryConfirmedAt: now,
      },
      statusHistory: [
        ...tx.statusHistory,
        {
          status: 'IN_PROGRESS',
          changedAt: now,
          note: 'Agente confirmó la entrega del producto al comprador',
        },
      ],
      updatedAt: now,
    };
    updated = demoCompleteIfBoth(updated, now);
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/delivery/confirm-delivery`,
    undefined,
    { timeout: 60_000 },
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
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/invite/refresh`,
  );
  return { data, source: 'api' };
}

function demoInvitePreview(token: string): InvitePreview | null {
  const found = loadDemoList().find((tx) => tx.invite.shareUrl?.includes(token));
  if (!found) return null;
  const publicSide =
    found.initiatedBy === 'SELLER' ? found.party?.seller : found.party?.buyer;
  return {
    code: found.code,
    title: found.title,
    productTitle: publicSide?.productTitle || found.product?.title,
    productDescription: publicSide?.productDescription || found.product?.description,
    amountCents: found.amountCents,
    currency: found.currency,
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
    const { data } = await apiClient.get<InvitePreview>(
      `/transactions/invite/${encodeURIComponent(token)}`,
    );
    return { data, source: 'api' };
  } catch (error) {
    if (token.startsWith('demo_')) {
      const demo = demoInvitePreview(token);
      if (demo) return { data: demo, source: 'demo' };
    }
    throw error instanceof Error ? error : new Error('Enlace inválido');
  }
}

function applyAcceptPurchaseDemo(
  token: string,
  payload: AcceptPurchasePayload,
): Transaction {
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
  const checklist = createDemoChecklist(payload.checklist);
  const meetingLocation =
    payload.meetingLocationMode === 'CHAT' ? undefined : payload.meetingLocation;
  const updated: Transaction = {
    ...current,
    status: 'ACCEPTED',
    operationDeadlineAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    party: {
      ...current.party,
      buyer: {
        conditionsSummary: payload.conditionsSummary,
        checklist,
        meetingLocation,
        productTitle: payload.productTitle,
        productDescription: payload.productDescription,
      },
    },
    viewerRole: 'BUYER',
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
        note: 'Comprador aceptó la compra — acuerdo cerrado, pendiente de pago',
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
      throw new Error(
        'Para aceptar la compra completá tus instrucciones para el Agente.',
      );
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
    const { data } = await apiClient.post<Transaction>(
      `/transactions/invite/${encodeURIComponent(token)}/join`,
    );
    return { data, source: 'api' };
  } catch (error) {
    throw error instanceof Error ? error : new Error('No se pudo unir a la operación');
  }
}

export async function acceptPurchase(
  token: string,
  payload: AcceptPurchasePayload,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    return { data: applyAcceptPurchaseDemo(token, payload), source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/invite/${encodeURIComponent(token)}/accept-purchase`,
    payload,
  );
  return { data, source: 'api' };
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
  const checklist = createDemoChecklist(payload.checklist);
  const meetingLocation =
    payload.meetingLocationMode === 'CHAT' ? undefined : payload.meetingLocation;

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
    operationDeadlineAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    party: {
      ...current.party,
      seller: {
        conditionsSummary: payload.conditionsSummary,
        checklist,
        meetingLocation,
        productTitle: payload.title,
        productDescription: payload.description,
      },
    },
    returnInstructions: payload.returnInstructions,
    viewerRole: 'SELLER',
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
        note: 'Vendedor confirmó la venta — acuerdo cerrado, pendiente de pago',
      },
    ],
    updatedAt: now,
  };

  // Demo: fotos no cuentan (requisito solo del vendedor).
  const buyerTitle = current.party?.buyer?.productTitle ?? '';
  const buyerDesc = current.party?.buyer?.productDescription ?? '';
  const changes: NonNullable<Transaction['pendingBuyerChanges']> = [];
  if (payload.title.trim() !== buyerTitle.trim()) {
    changes.push({ field: 'title', from: buyerTitle || '(vacío)', to: payload.title });
  }
  if (payload.description.trim() !== buyerDesc.trim()) {
    changes.push({
      field: 'description',
      from: buyerDesc || '(vacío)',
      to: payload.description,
    });
  }
  if (amountCents !== (current.amountCents ?? 0) || currency !== (current.currency ?? 'UYU')) {
    changes.push({
      field: 'price',
      from: `${((current.amountCents ?? 0) / 100).toFixed(2)} ${current.currency ?? 'UYU'}`,
      to: `${(amountCents / 100).toFixed(2)} ${currency}`,
    });
  }
  if (changes.length > 0) {
    updated.status = 'PENDING_BUYER_CONFIRM';
    updated.pendingBuyerChanges = changes;
    updated.statusHistory = [
      ...current.statusHistory,
      {
        status: 'PENDING_BUYER_CONFIRM',
        changedAt: now,
        note: 'Vendedor confirmó con cambios — pendiente de reconfirmación del comprador',
      },
    ];
  }

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
  const { data } = await apiClient.post<Transaction>(
    `/transactions/invite/${encodeURIComponent(token)}/confirm-sale`,
    payload,
  );
  return { data, source: 'api' };
}

export async function buyerConfirmChanges(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const current = list[index]!;
    if (current.status !== 'PENDING_BUYER_CONFIRM') {
      throw new Error('La operación no está pendiente de confirmación');
    }
    const now = new Date().toISOString();
    const updated: Transaction = {
      ...current,
      status: 'ACCEPTED',
      pendingBuyerChanges: undefined,
      statusHistory: [
        ...current.statusHistory,
        {
          status: 'ACCEPTED',
          changedAt: now,
          note: 'Comprador aceptó los cambios del vendedor',
        },
      ],
      updatedAt: now,
    };
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/buyer-confirm`,
  );
  return { data, source: 'api' };
}

export async function buyerRejectChanges(
  code: string,
): Promise<{ data: Transaction; source: 'api' | 'demo' }> {
  if (!hasAccessToken()) {
    const list = loadDemoList();
    const index = list.findIndex((tx) => tx.code === code.toUpperCase());
    if (index < 0) throw new Error('Operación no encontrada');
    const current = list[index]!;
    if (current.status !== 'PENDING_BUYER_CONFIRM') {
      throw new Error('La operación no está pendiente de confirmación');
    }
    const now = new Date().toISOString();
    const updated: Transaction = {
      ...current,
      status: 'CANCELLED',
      pendingBuyerChanges: undefined,
      statusHistory: [
        ...current.statusHistory,
        {
          status: 'CANCELLED',
          changedAt: now,
          note: 'Comprador rechazó los cambios del vendedor',
        },
      ],
      updatedAt: now,
    };
    const next = [...list];
    next[index] = updated;
    saveDemoList(next);
    return { data: updated, source: 'demo' };
  }
  const { data } = await apiClient.post<Transaction>(
    `/transactions/by-code/${encodeURIComponent(code)}/buyer-reject`,
  );
  return { data, source: 'api' };
}
