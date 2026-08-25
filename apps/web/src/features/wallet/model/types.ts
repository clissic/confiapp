export interface AgentCommissionBalances {
  currency: string;
  earnedCents: number;
  pendingCents: number;
  availableCents: number;
  reservedCents: number;
  paidCents: number;
}

export interface WalletSummary {
  status: string;
  currency: string;
  saldoCents: number;
  pendienteCents: number;
  retenidoCents: number;
  lifetimeEarnedCents: number;
  lifetimeSpentCents: number;
  lastMovementAt?: string;
  movementsCount: number;
  pendingWithdrawalsCount: number;
  commissionsTotalCents: number;
  agentCommissions?: AgentCommissionBalances | null;
  agentSelfServiceWithdrawalsEnabled?: boolean;
}

export interface WalletMovement {
  id: string;
  type: string;
  direction: string;
  amountCents: number;
  currency: string;
  description: string;
  paymentId?: string;
  transactionId?: string;
  withdrawalId?: string;
  createdAt: string;
  source?: string;
}

export interface WalletCommission {
  id: string;
  type: string;
  role: string;
  amountCents: number;
  currency: string;
  status: string;
  transactionId: string;
  createdAt: string;
  label: string;
}

export interface WalletWithdrawal {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  destinationHint?: string;
  requestedAt: string;
  processedAt?: string;
  failureReason?: string;
}
