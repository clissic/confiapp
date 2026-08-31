import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeWithdrawal,
  exportWalletHistory,
  fetchWalletCommissions,
  fetchWalletMovements,
  fetchWalletSummary,
  fetchWalletWithdrawals,
  requestWithdrawal,
} from '../api/wallet.api';
import type { WalletCommissionsQuery, WalletMovementsQuery } from '../model/types';

export const walletSummaryKey = ['wallet', 'summary'] as const;
export const walletMovementsKey = (query: WalletMovementsQuery) =>
  ['wallet', 'movements', query] as const;
export const walletCommissionsKey = (query: WalletCommissionsQuery) =>
  ['wallet', 'commissions', query] as const;
export const walletWithdrawalsKey = ['wallet', 'withdrawals'] as const;

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['wallet'] });
}

export function useWalletSummary() {
  return useQuery({ queryKey: walletSummaryKey, queryFn: fetchWalletSummary });
}

export function useWalletMovements(query: WalletMovementsQuery) {
  return useQuery({
    queryKey: walletMovementsKey(query),
    queryFn: () => fetchWalletMovements(query),
  });
}

export function useWalletCommissions(query: WalletCommissionsQuery) {
  return useQuery({
    queryKey: walletCommissionsKey(query),
    queryFn: () => fetchWalletCommissions(query),
  });
}

export function useWalletWithdrawals() {
  return useQuery({ queryKey: walletWithdrawalsKey, queryFn: fetchWalletWithdrawals });
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestWithdrawal,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCompleteWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeWithdrawal,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useExportWallet() {
  return useMutation({ mutationFn: exportWalletHistory });
}
