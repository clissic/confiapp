/**
 * Política de salida self-serve del Agente.
 *
 * Permitida mientras el intermediario aceptó el trabajo pero aún no inició
 * custodia/verificación. Una vez marcado algún ítem del checklist, cerrada la
 * verificación, o iniciada la confirmación de entrega, la salida libre se
 * bloquea (custodia física + evidencia). Emergencias: soporte/admin.
 */

export const AGENT_WITHDRAW_ALLOWED_STATUSES = [
  'WAITING_PARTICIPANT',
  'ACCEPTED',
  'FUNDED',
  'IN_PROGRESS',
  'DISPUTED',
] as const;

export type AgentWithdrawStatus = (typeof AGENT_WITHDRAW_ALLOWED_STATUSES)[number];

export type AgentWithdrawBlockReason =
  | 'STATUS'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_COMPLETED'
  | 'DELIVERY_STARTED';

export interface AgentWithdrawChecklistItem {
  done?: boolean;
}

export interface AgentWithdrawPolicyInput {
  status: string;
  agentVerification?: unknown | null;
  deliveryConfirmation?: {
    agentDeliveryConfirmedAt?: string | Date | null;
    buyerArrivalConfirmedAt?: string | Date | null;
    firstConfirmedAt?: string | Date | null;
  } | null;
  party?: {
    buyer?: { checklist?: AgentWithdrawChecklistItem[] | null } | null;
    seller?: { checklist?: AgentWithdrawChecklistItem[] | null } | null;
  } | null;
  /** Checklist legacy en conditions. */
  conditionsChecklist?: AgentWithdrawChecklistItem[] | null;
}

function checklistStarted(
  items: AgentWithdrawChecklistItem[] | null | undefined,
): boolean {
  return Boolean(items?.some((item) => Boolean(item.done)));
}

/** True si el Agente ya empezó custodia/verificación o entrega. */
export function hasAgentCustodyOrVerificationStarted(
  input: AgentWithdrawPolicyInput,
): boolean {
  if (input.agentVerification) return true;
  if (
    input.deliveryConfirmation?.agentDeliveryConfirmedAt ||
    input.deliveryConfirmation?.buyerArrivalConfirmedAt ||
    input.deliveryConfirmation?.firstConfirmedAt
  ) {
    return true;
  }
  if (checklistStarted(input.party?.buyer?.checklist ?? undefined)) return true;
  if (checklistStarted(input.party?.seller?.checklist ?? undefined)) return true;
  if (checklistStarted(input.conditionsChecklist ?? undefined)) return true;
  return false;
}

export function getAgentWithdrawBlockReason(
  input: AgentWithdrawPolicyInput,
): AgentWithdrawBlockReason | null {
  if (
    !AGENT_WITHDRAW_ALLOWED_STATUSES.includes(
      input.status as AgentWithdrawStatus,
    )
  ) {
    return 'STATUS';
  }
  if (input.agentVerification) return 'VERIFICATION_COMPLETED';
  if (
    input.deliveryConfirmation?.agentDeliveryConfirmedAt ||
    input.deliveryConfirmation?.buyerArrivalConfirmedAt ||
    input.deliveryConfirmation?.firstConfirmedAt
  ) {
    return 'DELIVERY_STARTED';
  }
  if (
    checklistStarted(input.party?.buyer?.checklist ?? undefined) ||
    checklistStarted(input.party?.seller?.checklist ?? undefined) ||
    checklistStarted(input.conditionsChecklist ?? undefined)
  ) {
    return 'VERIFICATION_STARTED';
  }
  return null;
}

export function canAgentSelfServeWithdraw(
  input: AgentWithdrawPolicyInput,
): boolean {
  return getAgentWithdrawBlockReason(input) === null;
}

export function agentWithdrawBlockedMessage(
  reason: AgentWithdrawBlockReason | null,
): string {
  switch (reason) {
    case 'VERIFICATION_STARTED':
      return 'Ya no podés solicitar salida: empezaste la verificación del producto. Con el bien en custodia, un reemplazo no puede continuar el trabajo. Contactá a soporte si hay una emergencia.';
    case 'VERIFICATION_COMPLETED':
      return 'Ya no podés solicitar salida: la verificación está cerrada. Si hay un problema, escalá por disputa o soporte.';
    case 'DELIVERY_STARTED':
      return 'Ya no podés solicitar salida: la entrega está en curso. Contactá a soporte si hay una emergencia.';
    case 'STATUS':
      return 'Esta operación no admite salida del agente.';
    default:
      return 'No se puede solicitar salida en este momento.';
  }
}
