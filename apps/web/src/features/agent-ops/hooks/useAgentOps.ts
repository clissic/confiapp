import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acceptOpenJob, listOpenJobs, searchAgents } from '../api/agent-ops.api';
import type { OpenJobsFilters } from '../model/open-jobs.types';

export const agentSearchQueryKey = ['agents', 'search'] as const;
export const openJobsQueryKey = ['agents', 'jobs', 'open'] as const;

export function useOpenJobs(filters: OpenJobsFilters, enabled = true) {
  return useQuery({
    queryKey: [...openJobsQueryKey, filters],
    queryFn: () => listOpenJobs(filters),
    enabled,
  });
}

export function useAcceptOpenJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptOpenJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: openJobsQueryKey });
    },
  });
}

export function useAgentSearch(params: {
  lng: number;
  lat: number;
  radiusKm: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [...agentSearchQueryKey, params],
    queryFn: () =>
      searchAgents({
        lng: params.lng,
        lat: params.lat,
        radiusKm: params.radiusKm,
      }),
    enabled: params.enabled !== false,
  });
}
