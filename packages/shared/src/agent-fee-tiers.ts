/**
 * Escalones de tarifa de intermediación (USD) según valor del producto.
 * Fuente de verdad compartida entre web (onboarding / trabajos) y API.
 */

export interface AgentFeeTier {
  /** Comisión total cobrada a usuarios (USD). */
  commissionUsd: number;
  /** Precio mínimo del producto inclusive (USD). */
  productMinUsd: number;
  /** Precio máximo exclusive; null = sin tope. */
  productMaxUsd: number | null;
}

export const AGENT_FEE_TIERS: readonly AgentFeeTier[] = [
  { commissionUsd: 10, productMinUsd: 0, productMaxUsd: 200 },
  { commissionUsd: 15, productMinUsd: 200, productMaxUsd: 600 },
  { commissionUsd: 20, productMinUsd: 600, productMaxUsd: 1_200 },
  { commissionUsd: 25, productMinUsd: 1_200, productMaxUsd: 2_000 },
  { commissionUsd: 35, productMinUsd: 2_000, productMaxUsd: null },
] as const;

export const AGENT_FEE_COMMISSION_VALUES = AGENT_FEE_TIERS.map(
  (t) => t.commissionUsd,
) as readonly number[];

/** Tasa UYU por 1 USD usada para clasificar escalones cuando el monto no está en USD. */
export const DEFAULT_UYU_PER_USD = 40;

export function getFeeTier(commissionUsd: number): AgentFeeTier | undefined {
  return AGENT_FEE_TIERS.find((t) => t.commissionUsd === commissionUsd);
}

/** Precio mínimo de producto (USD) para el filtro “comisión mín. ≥ N”. */
export function minProductUsdForMinCommission(commissionUsd: number): number {
  const tier = getFeeTier(commissionUsd);
  return tier?.productMinUsd ?? 0;
}

/** Comisión del escalón que aplica a un precio de producto en USD. */
export function commissionForProductUsd(productUsd: number): number {
  let fee = AGENT_FEE_TIERS[0]!.commissionUsd;
  for (const tier of AGENT_FEE_TIERS) {
    if (productUsd >= tier.productMinUsd) {
      fee = tier.commissionUsd;
    }
  }
  return fee;
}

/**
 * Convierte amountCents a USD para clasificar tarifa.
 * @param uyuPerUsd cuántos UYU equivalen a 1 USD
 */
export function amountCentsToUsd(
  amountCents: number,
  currency: string,
  uyuPerUsd: number = DEFAULT_UYU_PER_USD,
): number {
  const code = (currency || 'USD').toUpperCase();
  const major = amountCents / 100;
  if (code === 'USD') return major;
  if (code === 'UYU') {
    const rate = uyuPerUsd > 0 ? uyuPerUsd : DEFAULT_UYU_PER_USD;
    return major / rate;
  }
  return major;
}

/** Línea del popover de ayuda, p. ej. `USD $10 - Precio del producto: USD $0 > USD $200`. */
export function formatFeeTierPopoverLine(tier: AgentFeeTier): string {
  if (tier.productMaxUsd == null) {
    return `USD $${tier.commissionUsd} - Precio del producto: USD $${tier.productMinUsd} en adelante`;
  }
  return `USD $${tier.commissionUsd} - Precio del producto: USD $${tier.productMinUsd} > USD $${tier.productMaxUsd}`;
}

export function formatFeeTierSelectLabel(tier: AgentFeeTier): string {
  return `USD $${tier.commissionUsd}`;
}
