import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptPurchase,
  agentConfirmDelivery,
  buyerAcceptProduct,
  buyerConfirmArrival,
  buyerConfirmChanges,
  buyerRejectChanges,
  buyerRejectProduct,
  confirmSale,
  createSellerTransaction,
  createTransaction,
  getTransactionByCode,
  joinInvite,
  listTransactions,
  previewInvite,
  refreshInviteLink,
  finalizeAgentVerification,
  toggleChecklistItem,
} from '../api/transactions.api';
import type {
  AcceptPurchasePayload,
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
    mutationFn: ({
      token,
      payload,
    }: {
      token: string;
      payload: AcceptPurchasePayload;
    }) => acceptPurchase(token, payload),
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
    mutationFn: ({
      itemId,
      done,
      side,
    }: {
      itemId: string;
      done: boolean;
      side?: 'buyer' | 'seller';
    }) => toggleChecklistItem(code!, itemId, done, side),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
    },
  });
}

export function useFinalizeAgentVerification(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => finalizeAgentVerification(code!, note),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useBuyerAcceptProduct(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => buyerAcceptProduct(code!),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useBuyerRejectProduct(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => buyerRejectProduct(code!),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useBuyerConfirmArrival(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => buyerConfirmArrival(code!),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useAgentConfirmDelivery(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => agentConfirmDelivery(code!),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
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

export function useBuyerConfirmChanges(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => buyerConfirmChanges(code!),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}

export function useBuyerRejectChanges(code: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => buyerRejectChanges(code!),
    onSuccess: (result) => {
      queryClient.setQueryData(
        [...transactionsQueryKey, 'code', result.data.code],
        result,
      );
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
    },
  });
}
