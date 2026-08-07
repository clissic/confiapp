import { TransactionStatus } from '@confiapp/database';

import { ValidationError } from '../../shared/errors/app-error';

/**
 * Transiciones válidas de la operación de escrow.
 *
 * CREATED → WAITING_PARTICIPANT → [PENDING_BUYER_CONFIRM] → ACCEPTED → FUNDED → …
 * Cualquier estado activo (salvo COMPLETED) puede ir a CANCELLED o DISPUTED
 * según reglas específicas de cada caso de uso.
 */
const ALLOWED: Record<TransactionStatus, readonly TransactionStatus[]> = {
  [TransactionStatus.CREATED]: [
    TransactionStatus.WAITING_PARTICIPANT,
    TransactionStatus.CANCELLED,
  ],
  [TransactionStatus.WAITING_PARTICIPANT]: [
    TransactionStatus.PENDING_BUYER_CONFIRM,
    TransactionStatus.ACCEPTED,
    TransactionStatus.CANCELLED,
    TransactionStatus.DISPUTED,
  ],
  [TransactionStatus.PENDING_BUYER_CONFIRM]: [
    TransactionStatus.ACCEPTED,
    TransactionStatus.CANCELLED,
  ],
  [TransactionStatus.ACCEPTED]: [
    TransactionStatus.FUNDED,
    TransactionStatus.CANCELLED,
    TransactionStatus.DISPUTED,
  ],
  [TransactionStatus.FUNDED]: [
    TransactionStatus.IN_PROGRESS,
    TransactionStatus.COMPLETED,
    TransactionStatus.CANCELLED,
    TransactionStatus.DISPUTED,
  ],
  [TransactionStatus.IN_PROGRESS]: [
    TransactionStatus.COMPLETED,
    TransactionStatus.DISPUTED,
    TransactionStatus.CANCELLED,
  ],
  [TransactionStatus.COMPLETED]: [],
  [TransactionStatus.CANCELLED]: [],
  [TransactionStatus.DISPUTED]: [
    TransactionStatus.IN_PROGRESS,
    TransactionStatus.CANCELLED,
    TransactionStatus.COMPLETED,
  ],
};

export function canTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ValidationError(
      `Transición de estado inválida: ${from} → ${to}`,
      { from, to, allowed: ALLOWED[from] ?? [] },
    );
  }
}

export function getAllowedTransitions(
  from: TransactionStatus,
): readonly TransactionStatus[] {
  return ALLOWED[from] ?? [];
}
