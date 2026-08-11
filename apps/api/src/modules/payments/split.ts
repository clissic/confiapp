/**
 * Split de escrow: comisión fija por franja + reparto 20/80 sobre la comisión.
 */

import {
  computeIntermediationFees,
  IntermediationFeeError,
  type FeePayer,
  type IntermediationFees,
} from '@confiapp/shared';

export type { FeePayer, IntermediationFees };
export { IntermediationFeeError };

/** Forma de respuesta usada por checkout / escrow / UI. */
export type EscrowSplit = IntermediationFees;

export function computeEscrowSplit(input: {
  productCents: number;
  currency: string;
  feePayer: FeePayer;
  uyuPerUsd: number;
  platformCommissionBps?: number;
  agentCommissionBps?: number;
}): EscrowSplit {
  return computeIntermediationFees(input);
}

/** Centavos → unidad mayor para MP (UYU y USD usan 2 decimales). */
export function centsToMajorUnit(cents: number): number {
  return Math.round(cents) / 100;
}
