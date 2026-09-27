/** Días desde el acuerdo (join) usados para el recordatorio operativo. */
export const OPERATION_DEADLINE_DAYS = 21;

/** Umbral de copy: “más de 20 días” (el disparo real es a los 21). */
export const OPERATION_DEADLINE_REMINDER_DAYS_LABEL = 20;

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

/**
 * Antes bloqueaba acciones al vencer el plazo.
 * Ahora el plazo solo dispara un recordatorio (email); la operación sigue abierta.
 */
export function assertNotPastDeadline(_tx: {
  operationDeadlineAt?: Date | null;
}): void {
  // no-op a propósito
}
