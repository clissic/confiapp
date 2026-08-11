/**
 * Comisión de intermediación por franjas (USD) + quién la paga.
 * El precio acordado no se diluye: plataforma/agente se pagan solo de la comisión.
 */

import {
  amountCentsToUsd,
  commissionForProductUsd,
  DEFAULT_UYU_PER_USD,
} from './agent-fee-tiers.js';

export type FeePayer = 'BUYER' | 'SELLER' | 'SPLIT_50_50';

export const FEE_PAYER_VALUES = ['BUYER', 'SELLER', 'SPLIT_50_50'] as const;

export const FEE_PAYER_LABELS: Record<FeePayer, string> = {
  BUYER: 'La paga el comprador',
  SELLER: 'La paga el vendedor',
  SPLIT_50_50: '50 % comprador / 50 % vendedor',
};

/** BPS sobre la comisión (no sobre el precio del producto). */
export const DEFAULT_PLATFORM_COMMISSION_BPS = 2000; // 20 %
export const DEFAULT_AGENT_COMMISSION_BPS = 8000; // 80 %

export interface IntermediationFeesInput {
  productCents: number;
  currency: string;
  feePayer: FeePayer;
  /** UYU por 1 USD (solo para clasificar / convertir comisión). */
  uyuPerUsd?: number;
  platformCommissionBps?: number;
  agentCommissionBps?: number;
}

export interface IntermediationFees {
  productCents: number;
  currency: string;
  feePayer: FeePayer;
  /** Precio del producto en USD (para franja). */
  productUsd: number;
  commissionUsd: number;
  commissionCents: number;
  /** Monto que paga el comprador en checkout. */
  buyerPaysCents: number;
  /** Neto que recibe el vendedor al liberar. */
  sellerNetCents: number;
  platformFeeCents: number;
  agentFeeCents: number;
  platformCommissionBps: number;
  agentCommissionBps: number;
  /** Alias: lo retenido = lo que pagó el comprador. */
  grossCents: number;
  /** Alias de sellerNetCents (compat UI/API previa). */
  sellerCents: number;
}

export class IntermediationFeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntermediationFeeError';
  }
}

/** Comisión fija USD → centavos en la moneda de la operación. */
export function commissionUsdToCents(
  commissionUsd: number,
  currency: string,
  uyuPerUsd: number = DEFAULT_UYU_PER_USD,
): number {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'USD') {
    return Math.round(commissionUsd * 100);
  }
  if (code === 'UYU') {
    const rate = uyuPerUsd > 0 ? uyuPerUsd : DEFAULT_UYU_PER_USD;
    return Math.round(commissionUsd * rate * 100);
  }
  return Math.round(commissionUsd * 100);
}

export function computeIntermediationFees(
  input: IntermediationFeesInput,
): IntermediationFees {
  const productCents = Math.max(0, Math.trunc(input.productCents));
  const currency = (input.currency || 'USD').toUpperCase();
  const feePayer = input.feePayer;
  const uyuPerUsd = input.uyuPerUsd ?? DEFAULT_UYU_PER_USD;
  const platformCommissionBps =
    input.platformCommissionBps ?? DEFAULT_PLATFORM_COMMISSION_BPS;
  const agentCommissionBps =
    input.agentCommissionBps ?? DEFAULT_AGENT_COMMISSION_BPS;

  const productUsd = amountCentsToUsd(productCents, currency, uyuPerUsd);
  const commissionUsd = commissionForProductUsd(productUsd);
  const commissionCents = commissionUsdToCents(commissionUsd, currency, uyuPerUsd);

  const platformFeeCents = Math.floor(
    (commissionCents * platformCommissionBps) / 10_000,
  );
  let agentFeeCents = Math.floor((commissionCents * agentCommissionBps) / 10_000);
  const feesSum = platformFeeCents + agentFeeCents;
  if (feesSum < commissionCents) {
    agentFeeCents += commissionCents - feesSum;
  } else if (feesSum > commissionCents) {
    agentFeeCents = Math.max(0, commissionCents - platformFeeCents);
  }

  let buyerPaysCents: number;
  let sellerNetCents: number;

  if (feePayer === 'BUYER') {
    buyerPaysCents = productCents + commissionCents;
    sellerNetCents = productCents;
  } else if (feePayer === 'SELLER') {
    if (productCents < commissionCents) {
      throw new IntermediationFeeError(
        'El precio acordado no cubre la comisión de intermediación (vendedor asume el total).',
      );
    }
    buyerPaysCents = productCents;
    sellerNetCents = productCents - commissionCents;
  } else {
    const halfBuyer = Math.floor(commissionCents / 2);
    const halfSeller = commissionCents - halfBuyer;
    if (productCents < halfSeller) {
      throw new IntermediationFeeError(
        'El precio acordado no cubre la mitad de la comisión (reparto 50/50).',
      );
    }
    buyerPaysCents = productCents + halfBuyer;
    sellerNetCents = productCents - halfSeller;
  }

  return {
    productCents,
    currency,
    feePayer,
    productUsd,
    commissionUsd,
    commissionCents,
    buyerPaysCents,
    sellerNetCents,
    platformFeeCents,
    agentFeeCents,
    platformCommissionBps,
    agentCommissionBps,
    grossCents: buyerPaysCents,
    sellerCents: sellerNetCents,
  };
}
