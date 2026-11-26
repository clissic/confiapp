/**
 * Constantes de ciclo de vida de cuenta de usuario.
 */

/** Días de gracia tras solicitar eliminación de cuenta (suspensión recuperable por login). */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** Confirmación exacta que debe enviar el cliente para iniciar la baja. */
export const ACCOUNT_DELETION_CONFIRMATION = 'Eliminar';

export function addAccountDeletionGraceDays(
  from: Date,
  days = ACCOUNT_DELETION_GRACE_DAYS,
): Date {
  const result = new Date(from.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** True si la solicitud de baja aún está dentro de la ventana de recuperación. */
export function isAccountDeletionWithinGrace(
  requestedAt: Date | null | undefined,
  now: Date = new Date(),
  graceDays = ACCOUNT_DELETION_GRACE_DAYS,
): boolean {
  if (!requestedAt) return false;
  return now.getTime() < addAccountDeletionGraceDays(requestedAt, graceDays).getTime();
}
