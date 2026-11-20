import { apiClient } from '@/shared/api/client';

export type DisputeCategory =
  | 'NON_DELIVERY'
  | 'PRODUCT_MISMATCH'
  | 'FRAUD_SUSPECTED'
  | 'AGENT_CONDUCT'
  | 'OTHER';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'CLOSED';

export type EvidenceKind =
  | 'PARTICIPANTS'
  | 'OPERATION'
  | 'CHAT'
  | 'PAYMENT'
  | 'MEDIA'
  | 'IDENTITY'
  | 'STATUS_HISTORY'
  | 'OPENING'
  | 'PHOTO_ATTACHMENT';

export interface ActiveDispute {
  id: string;
  status: DisputeStatus;
  reason: string;
  category?: DisputeCategory;
  openedAt: string;
}

export interface DisputeListItem {
  id: string;
  transactionCode: string;
  transactionStatus: string;
  status: DisputeStatus;
  category?: DisputeCategory;
  reason: string;
  openedByName?: string;
  openedByEmail?: string;
  openedAt: string;
}

export interface DisputeListResponse {
  items: DisputeListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DisputeEvidenceItem {
  id: string;
  kind?: EvidenceKind | string;
  type: string;
  status: string;
  title: string;
  description?: string;
  storageKey?: string;
  mimeType?: string;
  payload?: Record<string, unknown>;
  signedUrl?: string;
  createdAt: string;
}

export interface DisputeDetail {
  id: string;
  status: DisputeStatus;
  category?: DisputeCategory;
  reason: string;
  resolutionNote?: string;
  openedAt: string;
  resolvedAt?: string;
  transaction: {
    id: string;
    code: string;
    status: string;
    title: string;
  };
  openedBy: {
    id: string;
    displayName?: string;
    email?: string;
  };
  resolvedBy?: {
    id: string;
    displayName?: string;
  };
  evidence: DisputeEvidenceItem[];
}

export async function openDispute(
  code: string,
  payload: {
    reason: string;
    category?: DisputeCategory;
    photoStorageKeys?: string[];
  },
): Promise<{ id: string; transactionCode: string; status: DisputeStatus }> {
  const { data } = await apiClient.post<{
    id: string;
    transactionCode: string;
    status: DisputeStatus;
  }>(`/disputes/transactions/${encodeURIComponent(code)}/open`, payload);
  return data;
}

export async function listDisputes(params?: {
  page?: number;
  limit?: number;
  status?: DisputeStatus;
}): Promise<DisputeListResponse> {
  const { data } = await apiClient.get<DisputeListResponse>('/disputes', { params });
  return data;
}

export async function getDispute(disputeId: string): Promise<DisputeDetail> {
  const { data } = await apiClient.get<DisputeDetail>(
    `/disputes/${encodeURIComponent(disputeId)}`,
  );
  return data;
}

export async function resolveDispute(
  disputeId: string,
  payload: {
    outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND';
    notes?: string;
  },
): Promise<{ id: string; status: DisputeStatus; transactionStatus: string }> {
  const { data } = await apiClient.post<{
    id: string;
    status: DisputeStatus;
    transactionStatus: string;
  }>(`/disputes/${encodeURIComponent(disputeId)}/resolve`, payload);
  return data;
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Abierta',
  UNDER_REVIEW: 'En revisión',
  RESOLVED: 'Resuelta',
  DISMISSED: 'Descartada',
  CLOSED: 'Cerrada',
};

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  NON_DELIVERY: 'No recibió el producto',
  PRODUCT_MISMATCH: 'El producto no coincide',
  FRAUD_SUSPECTED: 'Sospecha de fraude',
  AGENT_CONDUCT: 'Problema con el Agente',
  OTHER: 'Otro motivo',
};

export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  OPENING: 'Apertura',
  PARTICIPANTS: 'Participantes',
  IDENTITY: 'Identidad del Agente',
  OPERATION: 'Operación',
  STATUS_HISTORY: 'Historial de estados',
  PAYMENT: 'Pago',
  CHAT: 'Chats',
  MEDIA: 'Media de la operación',
  PHOTO_ATTACHMENT: 'Foto adjunta',
};
