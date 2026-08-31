import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createReview,
  fetchAdminReviews,
  fetchMyReputation,
  fetchMyReviews,
  fetchPendingTargets,
  fetchTransactionReviewsGiven,
} from '../api/reputation.api';
import type { CreateReviewPayload, PartyRole } from '../model/types';

export const reputationKey = ['reputation', 'me'] as const;
export const myReviewsKey = (role: PartyRole, page: number) =>
  ['reviews', 'mine', 'received', role, page] as const;
export const adminReviewsKey = (opts: {
  page: number;
  flaggedOnly: boolean;
}) => ['reviews', 'admin', opts] as const;
export const pendingTargetsKey = (code: string) =>
  ['reviews', 'pending', code] as const;
export const transactionReviewsGivenKey = (code: string) =>
  ['reviews', 'given', 'transaction', code] as const;

const MY_REVIEWS_PAGE_SIZE = 5;
const ADMIN_REVIEWS_PAGE_SIZE = 10;

export function useMyReputation() {
  return useQuery({ queryKey: reputationKey, queryFn: fetchMyReputation });
}

export function useMyReviews(role: PartyRole, page: number) {
  return useQuery({
    queryKey: myReviewsKey(role, page),
    queryFn: () =>
      fetchMyReviews({ role, page, limit: MY_REVIEWS_PAGE_SIZE }),
  });
}

export function useAdminReviews(opts: { page: number; flaggedOnly: boolean }) {
  return useQuery({
    queryKey: adminReviewsKey(opts),
    queryFn: () =>
      fetchAdminReviews({
        page: opts.page,
        limit: ADMIN_REVIEWS_PAGE_SIZE,
        flaggedOnly: opts.flaggedOnly,
      }),
  });
}

export function usePendingTargets(code?: string) {
  return useQuery({
    queryKey: pendingTargetsKey(code ?? ''),
    queryFn: () => fetchPendingTargets(code!),
    enabled: Boolean(code),
  });
}

export function useTransactionReviewsGiven(code?: string) {
  return useQuery({
    queryKey: transactionReviewsGivenKey(code ?? ''),
    queryFn: () => fetchTransactionReviewsGiven(code!),
    enabled: Boolean(code),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => createReview(payload),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: reputationKey });
      void qc.invalidateQueries({ queryKey: ['reviews', 'mine', 'received'] });
      void qc.invalidateQueries({ queryKey: ['reviews', 'admin'] });
      void qc.invalidateQueries({ queryKey: pendingTargetsKey(vars.transactionCode) });
      void qc.invalidateQueries({
        queryKey: transactionReviewsGivenKey(vars.transactionCode),
      });
    },
  });
}
