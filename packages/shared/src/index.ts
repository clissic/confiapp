/**
 * Paquete compartido de ConfiApp.
 * Aquí vivirán tipos, constantes y utilidades usadas por api y web.
 */

export const APP_NAME = 'ConfiApp' as const;

export type PackageStatus = 'scaffold';

export {
  AGENT_FEE_TIERS,
  AGENT_FEE_COMMISSION_VALUES,
  DEFAULT_UYU_PER_USD,
  amountCentsToUyu,
  amountCentsToUsd,
  commissionForProductUyu,
  commissionForProductUsd,
  formatFeeTierPopoverLine,
  formatFeeTierSelectLabel,
  getFeeTier,
  minProductUyuForMinCommission,
  minProductUsdForMinCommission,
  type AgentFeeTier,
} from './agent-fee-tiers.js';

export {
  FEE_PAYER_VALUES,
  FEE_PAYER_LABELS,
  DEFAULT_PLATFORM_COMMISSION_BPS,
  DEFAULT_AGENT_COMMISSION_BPS,
  commissionUyuToCents,
  commissionUsdToCents,
  computeIntermediationFees,
  IntermediationFeeError,
  type FeePayer,
  type IntermediationFees,
  type IntermediationFeesInput,
} from './intermediation-fees.js';

export {
  AGENT_FEE_ONLY_UYU_CENTS,
  AGENT_COMMISSION_HOLD_DAYS,
  AGENT_PAYOUT_WINDOW_START_DAY,
  AGENT_PAYOUT_WINDOW_END_DAY,
  addCommissionHoldDays,
  isWithinAgentPayoutWindow,
} from './finance-constants.js';

export {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_CONFIRMATION,
  addAccountDeletionGraceDays,
  isAccountDeletionWithinGrace,
} from './account-constants.js';

export {
  AGENT_WITHDRAW_ALLOWED_STATUSES,
  canAgentSelfServeWithdraw,
  getAgentWithdrawBlockReason,
  agentWithdrawBlockedMessage,
  hasAgentCustodyOrVerificationStarted,
  type AgentWithdrawBlockReason,
  type AgentWithdrawChecklistItem,
  type AgentWithdrawPolicyInput,
  type AgentWithdrawStatus,
} from './agent-withdraw-policy.js';
