import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createReview,
  fetchMyReputation,
  fetchMyReviews,
  fetchPendingTargets,
} from '../api/reputation.api';
import type { CreateReviewPayload } from '../model/types';

export const reputationKey = ['reputation', 'me'] as const;
export const myReviewsKey = ['reviews', 'mine', 'received'] as const;
export const pendingTargetsKey = (code: string) =>
  ['reviews', 'pending', code] as const;

export function useMyReputation() {
  return useQuery({ queryKey: reputationKey, queryFn: fetchMyReputation });
}

export function useMyReviews() {
  return useQuery({ queryKey: myReviewsKey, queryFn: fetchMyReviews });
}

export function usePendingTargets(code?: string) {
  return useQuery({
    queryKey: pendingTargetsKey(code ?? ''),
    queryFn: () => fetchPendingTargets(code!),
    enabled: Boolean(code),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => createReview(payload),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: reputationKey });
      void qc.invalidateQueries({ queryKey: myReviewsKey });
      void qc.invalidateQueries({ queryKey: pendingTargetsKey(vars.transactionCode) });
    },
  });
}
