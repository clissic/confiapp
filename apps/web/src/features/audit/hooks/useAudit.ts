import { useQuery } from '@tanstack/react-query';

import { fetchMyAuditLogs, type FetchAuditParams } from '../api/audit.api';

export const auditLogsKey = (params: FetchAuditParams) =>
  ['audit', 'mine', params.action ?? '', params.entityType ?? ''] as const;

export function useMyAuditLogs(params: FetchAuditParams = {}) {
  return useQuery({
    queryKey: auditLogsKey(params),
    queryFn: () => fetchMyAuditLogs(params),
  });
}
