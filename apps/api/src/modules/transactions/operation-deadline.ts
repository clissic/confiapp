import { ValidationError } from '../../shared/errors/app-error';

/** Plazo operativo desde el join (confirm-sale / accept-purchase) hasta liberar el pago. */
export const OPERATION_DEADLINE_DAYS = 21;

export function computeOperationDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + OPERATION_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
}

export function isPastOperationDeadline(
  deadlineAt?: Date | null,
  now: Date = new Date(),
): boolean {
  if (!deadlineAt) return false;
  return deadlineAt.getTime() < now.getTime();
}

export function assertNotPastDeadline(tx: {
  operationDeadlineAt?: Date | null;
}): void {
  if (isPastOperationDeadline(tx.operationDeadlineAt ?? null)) {
    throw new ValidationError(
      'La operación venció: el plazo de 21 días desde el acuerdo ya expiró',
      { code: 'OPERATION_DEADLINE_EXPIRED' },
    );
  }
}
