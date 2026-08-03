import { apiClient } from '@/shared/api/client';

import type { AuditListResponse, AuditLogItem } from '../model/types';

export interface FetchAuditParams {
  action?: string;
  entityType?: string;
  limit?: number;
  before?: string;
}

export async function fetchMyAuditLogs(
  params: FetchAuditParams = {},
): Promise<AuditLogItem[]> {
  const { data } = await apiClient.get<AuditListResponse>('/audit', {
    params: {
      mine: 'true',
      action: params.action || undefined,
      entityType: params.entityType || undefined,
      limit: params.limit ?? 50,
      before: params.before || undefined,
    },
  });
  return data.items;
}
