import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getEscrow,
  listMyPayments,
  listPaymentLogs,
  releaseEscrow,
  startCheckout,
} from '../api/payments.api';

export const paymentsQueryKey = ['payments'] as const;
export const escrowQueryKey = (code: string) => ['payments', 'escrow', code] as const;
export const paymentLogsQueryKey = ['payments', 'logs'] as const;

export function useMyPayments() {
  return useQuery({
    queryKey: paymentsQueryKey,
    queryFn: listMyPayments,
  });
}

export function useEscrow(code: string | null) {
  return useQuery({
    queryKey: escrowQueryKey(code ?? ''),
    queryFn: () => getEscrow(code!),
    enabled: Boolean(code),
  });
}

export function usePaymentLogs() {
  return useQuery({
    queryKey: paymentLogsQueryKey,
    queryFn: listPaymentLogs,
  });
}

export function useStartCheckout(code: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startCheckout(code!),
    onSuccess: () => {
      if (!code) return;
      void queryClient.invalidateQueries({ queryKey: escrowQueryKey(code) });
      void queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: paymentLogsQueryKey });
    },
  });
}

export function useReleaseEscrow(code: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => releaseEscrow(code!),
    onSuccess: () => {
      if (!code) return;
      void queryClient.invalidateQueries({ queryKey: escrowQueryKey(code) });
      void queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: paymentLogsQueryKey });
    },
  });
}
