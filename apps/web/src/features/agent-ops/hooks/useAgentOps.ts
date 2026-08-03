import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptAgentOffer,
  acceptOpenJob,
  listAgentOffers,
  listOpenJobs,
  offerAssignment,
  rejectAgentOffer,
  reassignAgent,
  searchAgents,
} from '../api/agent-ops.api';
import type { OpenJobsFilters } from '../model/open-jobs.types';

export const agentOffersQueryKey = ['agents', 'offers'] as const;
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

export function useAgentOffers() {
  return useQuery({
    queryKey: agentOffersQueryKey,
    queryFn: listAgentOffers,
    refetchInterval: 30_000,
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

export function useOfferAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: offerAssignment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentOffersQueryKey });
    },
  });
}

export function useAcceptOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptAgentOffer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentOffersQueryKey });
    },
  });
}

export function useRejectOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rejectAgentOffer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentOffersQueryKey });
    },
  });
}

export function useReassignAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reassignAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentOffersQueryKey });
    },
  });
}
