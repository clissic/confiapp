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
  /** Disponible para retiro self-service (ventas); excluye comisiones de agente. */
  salesWithdrawableCents?: number;
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
  transactionCode?: string;
  withdrawalId?: string;
  createdAt: string;
  source?: string;
}

export interface WalletMovementsPage {
  items: WalletMovement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source?: string;
}

export type WalletMovementsQuery = {
  page?: number;
  limit?: number;
  type?: string;
  direction?: string;
  transactionCode?: string;
  from?: string;
  to?: string;
};

export const WALLET_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ESCROW_HOLD: 'Retención protegida',
  ESCROW_RELEASE: 'Liberación',
  AGENT_PAYOUT: 'Pago a agente',
  PLATFORM_FEE: 'Comisión plataforma',
  WITHDRAWAL_REQUEST: 'Solicitud de retiro',
  WITHDRAWAL_COMPLETED: 'Retiro completado',
  WITHDRAWAL_REJECTED: 'Retiro rechazado',
  REFUND: 'Reembolso',
  ADJUSTMENT: 'Ajuste',
  COMMISSION_EARNED: 'Comisión generada',
  COMMISSION_AVAILABLE: 'Comisión disponible',
  PAYOUT_RESERVED: 'Payout reservado',
  PAYOUT_COMPLETED: 'Payout completado',
  PAYOUT_REVERSED: 'Payout revertido',
};

export interface WalletCommission {
  id: string;
  type: string;
  role: string;
  amountCents: number;
  currency: string;
  status: string;
  transactionId: string;
  transactionCode?: string;
  createdAt: string;
  label: string;
}

export interface WalletCommissionsPage {
  items: WalletCommission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source?: string;
}

export type WalletCommissionsQuery = {
  page?: number;
  limit?: number;
  type?: string;
  transactionCode?: string;
  from?: string;
  to?: string;
};

export const WALLET_COMMISSION_TYPE_LABELS: Record<string, string> = {
  PLATFORM_FEE: 'Comisión de plataforma',
  AGENT_PAYOUT: 'Comisión de agente',
};

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
