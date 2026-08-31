import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  disconnectMercadoPago,
  getEscrow,
  getManualPrexTransfer,
  getMercadoPagoConnection,
  listManualPrexTransfers,
  listMyPayments,
  listPaymentLogs,
  releaseEscrow,
  setManualPrexAdminConfirmation,
  startCheckout,
  startMercadoPagoOAuth,
  submitManualPrexTransfer,
} from '../api/payments.api';

export const paymentsQueryKey = ['payments'] as const;
export const escrowQueryKey = (code: string) => ['payments', 'escrow', code] as const;
export const paymentLogsQueryKey = ['payments', 'logs'] as const;
export const manualPrexTransfersQueryKey = (page: number) =>
  ['payments', 'admin', 'manual-transfers', page] as const;
export const manualPrexTransferQueryKey = (paymentId: string) =>
  ['payments', 'admin', 'manual-transfers', paymentId] as const;
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

export function useManualPrexTransfers(page = 1) {
  return useQuery({
    queryKey: manualPrexTransfersQueryKey(page),
    queryFn: () => listManualPrexTransfers({ page }),
  });
}

export function useManualPrexTransfer(paymentId: string | null) {
  return useQuery({
    queryKey: manualPrexTransferQueryKey(paymentId ?? ''),
    queryFn: () => getManualPrexTransfer(paymentId!),
    enabled: Boolean(paymentId),
  });
}

export function useSetManualPrexAdminConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      confirmed,
    }: {
      paymentId: string;
      confirmed: boolean;
    }) => setManualPrexAdminConfirmation(paymentId, confirmed),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'admin', 'manual-transfers'],
      });
      void queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: paymentLogsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['agents', 'jobs', 'open'] });
      if (data.transactionCode) {
        void queryClient.invalidateQueries({
          queryKey: escrowQueryKey(data.transactionCode),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['payments', 'escrow'] });
      }
    },
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

export function useSubmitManualPrexTransfer(code: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { receiptDataUrl: string; receiptFileName?: string }) =>
      submitManualPrexTransfer(code!, payload),
    onSuccess: () => {
      if (!code) return;
      void queryClient.invalidateQueries({ queryKey: escrowQueryKey(code) });
      void queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: paymentLogsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['payments', 'admin', 'manual-transfers'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
