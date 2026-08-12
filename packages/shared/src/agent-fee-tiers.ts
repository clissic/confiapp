/**
 * Escalones de tarifa de intermediación (UYU) según valor del producto.
 * Fuente de verdad compartida entre web (onboarding / trabajos) y API.
 *
 * Equivalencia histórica (tasa 40 UYU = 1 USD):
 * USD 10/15/20/25/35 → UYU 400/600/800/1000/1400
 * Franjas de producto ×40.
 */

export interface AgentFeeTier {
  /** Comisión total cobrada a usuarios (UYU). */
  commissionUyu: number;
  /** Precio mínimo del producto inclusive (UYU). */
  productMinUyu: number;
  /** Precio máximo exclusive; null = sin tope. */
  productMaxUyu: number | null;
}

export const AGENT_FEE_TIERS: readonly AgentFeeTier[] = [
  { commissionUyu: 400, productMinUyu: 0, productMaxUyu: 8_000 },
  { commissionUyu: 600, productMinUyu: 8_000, productMaxUyu: 24_000 },
  { commissionUyu: 800, productMinUyu: 24_000, productMaxUyu: 48_000 },
  { commissionUyu: 1_000, productMinUyu: 48_000, productMaxUyu: 80_000 },
  { commissionUyu: 1_400, productMinUyu: 80_000, productMaxUyu: null },
] as const;

export const AGENT_FEE_COMMISSION_VALUES = AGENT_FEE_TIERS.map(
  (t) => t.commissionUyu,
) as readonly number[];

/** Tasa UYU por 1 USD (legacy: clasificar ops en USD si aún existieran). */
export const DEFAULT_UYU_PER_USD = 40;

export function getFeeTier(commissionUyu: number): AgentFeeTier | undefined {
  return AGENT_FEE_TIERS.find((t) => t.commissionUyu === commissionUyu);
}

/** Precio mínimo de producto (UYU) para el filtro “comisión mín. ≥ N”. */
export function minProductUyuForMinCommission(commissionUyu: number): number {
  const tier = getFeeTier(commissionUyu);
  return tier?.productMinUyu ?? 0;
}

/** Comisión del escalón que aplica a un precio de producto en UYU. */
export function commissionForProductUyu(productUyu: number): number {
  let fee = AGENT_FEE_TIERS[0]!.commissionUyu;
  for (const tier of AGENT_FEE_TIERS) {
    if (productUyu >= tier.productMinUyu) {
      fee = tier.commissionUyu;
    }
  }
  return fee;
}

/**
 * Convierte amountCents a UYU (unidad mayor) para clasificar tarifa.
 * @param uyuPerUsd cuántos UYU equivalen a 1 USD (solo si currency === USD)
 */
export function amountCentsToUyu(
  amountCents: number,
  currency: string,
  uyuPerUsd: number = DEFAULT_UYU_PER_USD,
): number {
  const code = (currency || 'UYU').toUpperCase();
  const major = amountCents / 100;
  if (code === 'UYU') return major;
  if (code === 'USD') {
    const rate = uyuPerUsd > 0 ? uyuPerUsd : DEFAULT_UYU_PER_USD;
    return major * rate;
  }
  return major;
}

function formatUyuMajor(value: number): string {
  return new Intl.NumberFormat('es-UY', {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Línea del popover de ayuda, p. ej. `UYU $400 - Precio del producto: UYU $0 > UYU $8.000`. */
export function formatFeeTierPopoverLine(tier: AgentFeeTier): string {
  const fee = formatUyuMajor(tier.commissionUyu);
  const min = formatUyuMajor(tier.productMinUyu);
  if (tier.productMaxUyu == null) {
    return `UYU $${fee} - Precio del producto: UYU $${min} en adelante`;
  }
  const max = formatUyuMajor(tier.productMaxUyu);
  return `UYU $${fee} - Precio del producto: UYU $${min} > UYU $${max}`;
}

export function formatFeeTierSelectLabel(tier: AgentFeeTier): string {
  return `UYU $${formatUyuMajor(tier.commissionUyu)}`;
}

/** @deprecated Usar amountCentsToUyu */
export const amountCentsToUsd = amountCentsToUyu;
/** @deprecated Usar commissionForProductUyu */
export const commissionForProductUsd = commissionForProductUyu;
/** @deprecated Usar minProductUyuForMinCommission */
export const minProductUsdForMinCommission = minProductUyuForMinCommission;
