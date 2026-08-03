import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchAgentOnboarding,
  saveAgentOnboardingDraft,
  submitAgentOnboarding,
} from '../api/agent-onboarding.api';
import type {
  AgentOnboarding,
  AgentOnboardingDraftPayload,
  AgentOnboardingSubmitPayload,
} from '../model/types';

export const agentOnboardingQueryKey = ['agents', 'onboarding'] as const;

type QueryData = { data: AgentOnboarding; source: 'api' | 'demo' };

export function useAgentOnboarding() {
  return useQuery({
    queryKey: agentOnboardingQueryKey,
    queryFn: fetchAgentOnboarding,
  });
}

export function useSaveAgentDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AgentOnboardingDraftPayload) => {
      const cached = queryClient.getQueryData<QueryData>(agentOnboardingQueryKey);
      return saveAgentOnboardingDraft(payload, cached?.data);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(agentOnboardingQueryKey, result);
    },
  });
}

export function useSubmitAgentOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AgentOnboardingSubmitPayload) => {
      const cached = queryClient.getQueryData<QueryData>(agentOnboardingQueryKey);
      return submitAgentOnboarding(payload, cached?.data);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(agentOnboardingQueryKey, result);
    },
  });
}
