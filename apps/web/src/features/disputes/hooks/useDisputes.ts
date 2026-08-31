import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { transactionsQueryKey } from '@/features/transactions/hooks/useTransactions';

import {
  getDispute,
  listDisputes,
  openDispute,
  resolveDispute,
  type DisputeCategory,
  type DisputeStatus,
} from '../api/disputes.api';

export const disputesQueryKey = ['disputes'] as const;

export function useDisputes(page = 1, status?: DisputeStatus) {
  return useQuery({
    queryKey: [...disputesQueryKey, 'list', page, status ?? 'all'],
    queryFn: () => listDisputes({ page, limit: 10, status }),
  });
}

export function useDispute(disputeId: string | null) {
  return useQuery({
    queryKey: [...disputesQueryKey, 'detail', disputeId],
    queryFn: () => getDispute(disputeId!),
    enabled: Boolean(disputeId),
  });
}

export function useOpenDispute(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { reason: string; category?: DisputeCategory }) =>
      openDispute(code, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
      void queryClient.invalidateQueries({ queryKey: disputesQueryKey });
    },
  });
}

export function useResolveDispute(disputeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND';
      notes?: string;
    }) => resolveDispute(disputeId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: disputesQueryKey });
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}
