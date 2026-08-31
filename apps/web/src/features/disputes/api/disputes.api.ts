import { apiClient } from '@/shared/api/client';

export type DisputeCategory = 'NON_DELIVERY' | 'OTHER';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'CLOSED';

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
}

export async function openDispute(
  code: string,
  payload: { reason: string; category?: DisputeCategory },
): Promise<{ id: string; transactionCode: string; status: DisputeStatus }> {
  const { data } = await apiClient.post<{ id: string; transactionCode: string; status: DisputeStatus }>(
    `/disputes/transactions/${encodeURIComponent(code)}/open`,
    payload,
  );
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
  const { data } = await apiClient.get<DisputeDetail>(`/disputes/${encodeURIComponent(disputeId)}`);
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
  OTHER: 'Otro motivo',
};
