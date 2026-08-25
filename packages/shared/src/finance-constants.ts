/**
 * Constantes del sistema financiero MVP (UYU).
 */

/** Días de hold antes de que una comisión PENDING pase a AVAILABLE. */
export const AGENT_COMMISSION_HOLD_DAYS = 21;

/** Ventana mensual de liquidación manual (día inclusive). */
export const AGENT_PAYOUT_WINDOW_START_DAY = 1;
export const AGENT_PAYOUT_WINDOW_END_DAY = 10;

export function addCommissionHoldDays(from: Date, days = AGENT_COMMISSION_HOLD_DAYS): Date {
  const result = new Date(from.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Día del mes en timezone local del servidor (MVP: America/Montevideo asumido via Date). */
export function isWithinAgentPayoutWindow(now: Date = new Date()): boolean {
  const day = now.getDate();
  return day >= AGENT_PAYOUT_WINDOW_START_DAY && day <= AGENT_PAYOUT_WINDOW_END_DAY;
}
