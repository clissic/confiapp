import { apiClient } from '@/shared/api/client';

import {
  AUDIT_PAGE_SIZE,
  type AuditListResponse,
} from '../model/types';

export interface FetchAuditParams {
  action?: string;
  entityType?: string;
  limit?: number;
  page?: number;
  before?: string;
}

export async function fetchMyAuditLogs(
  params: FetchAuditParams = {},
): Promise<AuditListResponse> {
  const { data } = await apiClient.get<AuditListResponse>('/audit', {
    params: {
      mine: 'true',
      action: params.action || undefined,
      entityType: params.entityType || undefined,
      limit: params.limit ?? AUDIT_PAGE_SIZE,
      page: params.page ?? 1,
      before: params.before || undefined,
    },
  });
  return {
    items: data.items ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    limit: data.limit ?? AUDIT_PAGE_SIZE,
    totalPages: data.totalPages ?? 0,
  };
}
