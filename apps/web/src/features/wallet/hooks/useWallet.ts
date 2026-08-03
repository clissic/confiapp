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

export const walletSummaryKey = ['wallet', 'summary'] as const;
export const walletMovementsKey = ['wallet', 'movements'] as const;
export const walletCommissionsKey = ['wallet', 'commissions'] as const;
export const walletWithdrawalsKey = ['wallet', 'withdrawals'] as const;

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['wallet'] });
}

export function useWalletSummary() {
  return useQuery({ queryKey: walletSummaryKey, queryFn: fetchWalletSummary });
}

export function useWalletMovements() {
  return useQuery({ queryKey: walletMovementsKey, queryFn: fetchWalletMovements });
}

export function useWalletCommissions() {
  return useQuery({ queryKey: walletCommissionsKey, queryFn: fetchWalletCommissions });
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
