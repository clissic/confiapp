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
  ID_DIGITAL_VERIFIED: 'Identidad Digital verificada',
  ID_DIGITAL_FAILED: 'Identidad Digital fallida',
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
  PAYMENT_RELEASED: 'Operación cerrada — comisión acreditada',
  PAYMENT_REFUNDED: 'Pago reembolsado',
  /** Cierre de operación: se libera la comisión del agente al ledger. */
  ESCROW_RELEASED: 'Comisión liberada',
};

/** Texto corto para el panel desplegable de cada evento financiero. */
export const FINANCIAL_AUDIT_ACTION_DESCRIPTIONS: Record<string, string> = {
  COMMISSION_EARNED:
    'La operación se completó y se registró la comisión del agente (queda en espera el período de retención).',
  COMMISSION_AVAILABLE:
    'Terminó el período de retención: la comisión del agente ya está disponible para liquidar.',
  COMMISSION_BLOCKED: 'La comisión quedó bloqueada y no se puede liquidar por ahora.',
  COMMISSION_REVERSED: 'Se revirtió una comisión previamente registrada (p. ej. por reembolso).',
  PAYOUT_RESERVED: 'Se reservó un monto de comisión para incluirlo en una liquidación.',
  PAYOUT_COMPLETED: 'La transferencia de liquidación al agente quedó marcada como pagada.',
  PAYOUT_BATCH_CREATED: 'Se armó un lote de liquidación con comisiones disponibles.',
  PAYMENT_CAPTURED: 'Se capturó el cobro de la contratación del Agente.',
  PAYMENT_RELEASED: 'Se cerró la operación y se acreditó la comisión correspondiente.',
  PAYMENT_REFUNDED: 'Se registró un reembolso de la contratación del Agente.',
  ESCROW_RELEASED:
    'La operación se cerró: se liberó la parte de comisión del agente y quedó registrada en el ledger financiero.',
};

export const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  AVAILABLE: 'Disponible',
  BLOCKED: 'Bloqueada',
  REVERSED: 'Revertida',
  COMPLETED: 'Completada',
  PENDING_TRANSFER: 'Transferencia pendiente',
  PAID: 'Pagada',
  FAILED: 'Fallida',
  CANCELLED: 'Cancelada',
};

export const AUDIT_ACTION_DESCRIPTIONS: Record<string, string> = {
  CREATE: 'Se creó un registro nuevo en el sistema.',
  UPDATE: 'Se actualizaron datos de un registro existente.',
  DELETE: 'Se eliminó (o archivó) un registro.',
  STATUS_CHANGE: 'Cambió el estado de una operación o entidad.',
  PARTICIPANT_ADDED: 'Se agregó un participante a la operación.',
  PARTICIPANT_UPDATED: 'Se actualizó el estado o datos de un participante.',
  EVIDENCE_ADDED: 'Se cargó evidencia asociada a la operación.',
  EVIDENCE_UPDATED: 'Se actualizó evidencia de la operación.',
  DISPUTE_OPENED: 'Se abrió una disputa sobre la operación.',
  DISPUTE_UPDATED: 'Se actualizó el estado o resolución de una disputa.',
  PAYMENT_CREATED: 'Se creó un pago o retención.',
  PAYMENT_UPDATED: 'Se actualizó el estado o datos de un pago.',
  MESSAGE_SENT: 'Se envió un mensaje en el chat.',
  REVIEW_CREATED: 'Se publicó una reseña.',
  LOGIN: 'Inicio de sesión correcto.',
  LOGOUT: 'Cierre de sesión.',
  LOGIN_FAILED: 'Intento de inicio de sesión fallido.',
  REGISTER: 'Se registró una cuenta nueva.',
  PASSWORD_CHANGE: 'Se cambió la contraseña de la cuenta.',
  PASSWORD_RESET: 'Se restableció la contraseña de la cuenta.',
  EMAIL_VERIFIED: 'Se verificó el email de la cuenta.',
  AGENT_OFFERED: 'Se ofreció un trabajo a un agente.',
  AGENT_ACCEPTED: 'Un agente aceptó un trabajo u oferta.',
  AGENT_REJECTED: 'Un agente rechazó un trabajo u oferta.',
  AGENT_REASSIGNED: 'Se reasignó el agente de la operación.',
  ROLE_CHANGED: 'Cambió el rol de plataforma de un usuario.',
  WALLET_WITHDRAWAL: 'Se solicitó o actualizó un retiro de wallet.',
  WALLET_MOVEMENT: 'Se registró un movimiento en la billetera.',
  CHAT_CREATED: 'Se creó un chat de la operación.',
  ID_DIGITAL_VERIFIED: 'La Identidad Digital del agente se verificó correctamente.',
  ID_DIGITAL_FAILED: 'Falló la verificación de Identidad Digital.',
  SYSTEM: 'Evento interno del sistema.',
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

export function describeFinancialAuditAction(action: string): string {
  return (
    FINANCIAL_AUDIT_ACTION_DESCRIPTIONS[action] ??
    'Evento del ledger financiero de ConfiApp.'
  );
}

export function labelFinancialStatus(status: string): string {
  return FINANCIAL_STATUS_LABELS[status] ?? status;
}

export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_DESCRIPTIONS[action] ?? 'Evento registrado en la auditoría de ConfiApp.';
}
