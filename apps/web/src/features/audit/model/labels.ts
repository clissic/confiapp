/** Etiquetas humanas para eventos de auditoría general. */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de estado',
  PARTICIPANT_ADDED: 'Participante agregado',
  PARTICIPANT_UPDATED: 'Participante actualizado',
  EVIDENCE_ADDED: 'Evidencia agregada',
  EVIDENCE_UPDATED: 'Evidencia actualizada',
  DISPUTE_OPENED: 'Disputa abierta',
  DISPUTE_UPDATED: 'Disputa actualizada',
  PAYMENT_CREATED: 'Pago creado',
  PAYMENT_UPDATED: 'Pago actualizado',
  MESSAGE_SENT: 'Mensaje enviado',
  REVIEW_CREATED: 'Reseña publicada',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  LOGIN_FAILED: 'Inicio fallido',
  REGISTER: 'Registro',
  PASSWORD_CHANGE: 'Cambio de contraseña',
  PASSWORD_RESET: 'Restablecimiento de contraseña',
  EMAIL_VERIFIED: 'Email verificado',
  AGENT_OFFERED: 'Oferta a agente',
  AGENT_ACCEPTED: 'Agente aceptó',
  AGENT_REJECTED: 'Agente rechazó',
  AGENT_REASSIGNED: 'Agente reasignado',
  ROLE_CHANGED: 'Cambio de rol',
  WALLET_WITHDRAWAL: 'Retiro de wallet',
  WALLET_MOVEMENT: 'Movimiento de wallet',
  CHAT_CREATED: 'Chat creado',
  SYSTEM: 'Evento del sistema',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  User: 'Usuario',
  Transaction: 'Operación',
  Payment: 'Pago',
  Withdrawal: 'Retiro',
  Chat: 'Chat',
  Message: 'Mensaje',
  Notification: 'Notificación',
  Review: 'Reseña',
  AgentProfile: 'Perfil de agente',
  Dispute: 'Disputa',
  Evidence: 'Evidencia',
};

export const AUDIT_OUTCOME_LABELS: Record<string, string> = {
  SUCCESS: 'Éxito',
  FAILURE: 'Fallo',
};

export const FINANCIAL_AUDIT_ACTION_LABELS: Record<string, string> = {
  COMMISSION_EARNED: 'Comisión ganada',
  COMMISSION_AVAILABLE: 'Comisión disponible',
  COMMISSION_BLOCKED: 'Comisión bloqueada',
  COMMISSION_REVERSED: 'Comisión revertida',
  PAYOUT_RESERVED: 'Pago reservado',
  PAYOUT_COMPLETED: 'Pago completado',
  PAYOUT_BATCH_CREATED: 'Liquidación creada',
  PAYMENT_CAPTURED: 'Pago capturado',
  PAYMENT_RELEASED: 'Pago liberado',
  PAYMENT_REFUNDED: 'Pago reembolsado',
};

export function labelAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function labelAuditEntity(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

export function labelAuditOutcome(outcome: string): string {
  return AUDIT_OUTCOME_LABELS[outcome] ?? outcome;
}

export function labelFinancialAuditAction(action: string): string {
  return FINANCIAL_AUDIT_ACTION_LABELS[action] ?? action;
}
