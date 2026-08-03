import type { Types } from 'mongoose';

import type { AuditAction, AuditOutcome } from '../types/enums';

/**
 * Registro append-only de auditoría forense.
 *
 * Diseñado para reconstruir: quién · qué · sobre qué entidad · cuándo · desde dónde · resultado.
 * No se actualiza ni se borra (sin updatedAt / deletedAt).
 *
 * entityType típicos: User | Transaction | Payment | Wallet | Chat | Message |
 * Notification | Withdrawal | Session | Agent | System
 */
export interface IAuditLog {
  /** Usuario que ejecutó la acción (omitido en SYSTEM o actores anónimos). */
  actor?: Types.ObjectId;
  /** Snapshot del rol principal del actor al momento del evento. */
  actorRole?: string;
  action: AuditAction;
  /** Nombre de colección / agregado de dominio. */
  entityType: string;
  /** Id de la entidad afectada (ObjectId válido). */
  entityId: Types.ObjectId;
  /** success | failure — útil en logins y pagos. */
  outcome?: AuditOutcome;
  /**
   * Correlación cross-servicio (request id, payment idempotency, tx.code, etc.).
   */
  correlationId?: string;
  /**
   * Contexto forense: before/after/diff, reason, montos, status from→to, etc.
   * Nunca secretos (passwords, tokens en claro, PAN).
   */
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
