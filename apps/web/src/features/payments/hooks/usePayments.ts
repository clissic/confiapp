import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  disconnectMercadoPago,
  getEscrow,
  getMercadoPagoConnection,
  listMyPayments,
  listPaymentLogs,
  releaseEscrow,
  startCheckout,
  startMercadoPagoOAuth,
} from '../api/payments.api';

export const paymentsQueryKey = ['payments'] as const;
export const escrowQueryKey = (code: string) => ['payments', 'escrow', code] as const;
export const paymentLogsQueryKey = ['payments', 'logs'] as const;
export const mpConnectionQueryKey = ['payments', 'mercadopago', 'connection'] as const;

export function useMercadoPagoConnection() {
  return useQuery({
    queryKey: mpConnectionQueryKey,
    queryFn: getMercadoPagoConnection,
  });
}

export function useStartMercadoPagoOAuth() {
  return useMutation({
    mutationFn: startMercadoPagoOAuth,
  });
}

export function useDisconnectMercadoPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectMercadoPago,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mpConnectionQueryKey });
    },
  });
}

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
