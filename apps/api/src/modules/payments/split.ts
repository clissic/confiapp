/**
 * Cálculo de split de escrow (Uruguay: UYU o USD).
 * Ejemplo UYU: bruto $50.000 → plataforma 20% / agente 5% / vendedor 75%.
 */
export interface EscrowSplit {
  grossCents: number;
  platformFeeCents: number;
  agentFeeCents: number;
  sellerCents: number;
  platformFeeBps: number;
  agentFeeBps: number;
}

export function computeEscrowSplit(
  grossCents: number,
  platformFeeBps: number,
  agentFeeBps: number,
): EscrowSplit {
  const safeGross = Math.max(0, Math.trunc(grossCents));
  const platformFeeCents = Math.floor((safeGross * platformFeeBps) / 10_000);
  const agentFeeCents = Math.floor((safeGross * agentFeeBps) / 10_000);
  let sellerCents = safeGross - platformFeeCents - agentFeeCents;
  if (sellerCents < 0) {
    sellerCents = 0;
  }
  return {
    grossCents: safeGross,
    platformFeeCents,
    agentFeeCents,
    sellerCents,
    platformFeeBps,
    agentFeeBps,
  };
}

/** Centavos → unidad mayor para MP (UYU y USD usan 2 decimales). */
export function centsToMajorUnit(cents: number): number {
  return Math.round(cents) / 100;
}
