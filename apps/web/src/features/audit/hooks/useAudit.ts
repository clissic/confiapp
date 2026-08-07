import { useQuery } from '@tanstack/react-query';

import { fetchAuditLogs, type FetchAuditParams } from '../api/audit.api';

export const auditLogsKey = (params: FetchAuditParams) =>
  [
    'audit',
    'all',
    params.action ?? '',
    params.entityType ?? '',
    params.page ?? 1,
    params.limit ?? 20,
  ] as const;

export function useAuditLogs(params: FetchAuditParams = {}) {
  return useQuery({
    queryKey: auditLogsKey(params),
    queryFn: () => fetchAuditLogs(params),
  });
}

/** @deprecated Usar useAuditLogs */
export const useMyAuditLogs = useAuditLogs;
