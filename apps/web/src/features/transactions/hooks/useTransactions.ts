import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptPurchase,
  confirmSale,
  createSellerTransaction,
  createTransaction,
  getTransactionByCode,
  joinInvite,
  listTransactions,
  previewInvite,
  refreshInviteLink,
  toggleChecklistItem,
} from '../api/transactions.api';
import type {
  ConfirmSalePayload,
  CreateSellerTransactionPayload,
  CreateTransactionPayload,
} from '../model/types';

export const transactionsQueryKey = ['transactions'] as const;

export function useTransactions() {
  return useQuery({
    queryKey: transactionsQueryKey,
    queryFn: listTransactions,
  });
}

export function useTransaction(code: string | undefined) {
  return useQuery({
    queryKey: [...transactionsQueryKey, 'code', code],
    queryFn: () => getTransactionByCode(code!),
    enabled: Boolean(code),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) => createTransaction(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useCreateSellerTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSellerTransactionPayload) =>
      createSellerTransaction(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useRefreshInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => refreshInviteLink(code),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: [...transactionsQueryKey, 'invite', token],
    queryFn: () => previewInvite(token!),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useJoinInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => joinInvite(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useAcceptPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptPurchase(token),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useToggleChecklistItem(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      toggleChecklistItem(code!, itemId, done),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
    },
  });
}

export function useConfirmSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      token,
      payload,
    }: {
      token: string;
      payload: ConfirmSalePayload;
    }) => confirmSale(token, payload),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}
