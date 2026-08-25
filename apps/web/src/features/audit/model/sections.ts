export type AuditSectionConfig = {
  id: string;
  path: string;
  label: string;
  lead: string;
  /** Entidad por defecto al abrir la sección */
  defaultEntityType: string;
  /** Entidades que se pueden elegir en filtros */
  entityTypes: string[];
  /** Acciones relevantes para esta sección (vacío = todas) */
  actionCodes: string[];
};

export const AUDIT_SECTIONS: AuditSectionConfig[] = [
  {
    id: 'acceso',
    path: 'acceso',
    label: 'Acceso y cuentas',
    lead: 'Inicios de sesión, registros, verificación de email y cambios de rol.',
    defaultEntityType: 'User',
    entityTypes: ['User'],
    actionCodes: [
      'LOGIN',
      'LOGOUT',
      'LOGIN_FAILED',
      'REGISTER',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'EMAIL_VERIFIED',
      'ROLE_CHANGED',
    ],
  },
  {
    id: 'operaciones',
    path: 'operaciones',
    label: 'Operaciones',
    lead: 'Creación, cambios de estado, participantes, disputas y evidencia.',
    defaultEntityType: 'Transaction',
    entityTypes: ['Transaction', 'Dispute', 'Evidence'],
    actionCodes: [
      'CREATE',
      'UPDATE',
      'STATUS_CHANGE',
      'PARTICIPANT_ADDED',
      'PARTICIPANT_UPDATED',
      'EVIDENCE_ADDED',
      'EVIDENCE_UPDATED',
      'DISPUTE_OPENED',
      'DISPUTE_UPDATED',
    ],
  },
  {
    id: 'pagos',
    path: 'pagos',
    label: 'Pagos y wallet',
    lead: 'Retenciones, liberaciones, reembolsos y movimientos de billetera.',
    defaultEntityType: 'Payment',
    entityTypes: ['Payment', 'Withdrawal'],
    actionCodes: [
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'WALLET_WITHDRAWAL',
      'WALLET_MOVEMENT',
    ],
  },
  {
    id: 'agentes',
    path: 'agentes',
    label: 'Agentes',
    lead: 'Ofertas, aceptaciones, rechazos y reasignaciones de agentes.',
    defaultEntityType: 'AgentProfile',
    entityTypes: ['AgentProfile', 'Transaction'],
    actionCodes: [
      'AGENT_OFFERED',
      'AGENT_ACCEPTED',
      'AGENT_REJECTED',
      'AGENT_REASSIGNED',
    ],
  },
  {
    id: 'comunicacion',
    path: 'comunicacion',
    label: 'Comunicación',
    lead: 'Chats, mensajes y reseñas entre participantes.',
    defaultEntityType: 'Chat',
    entityTypes: ['Chat', 'Message', 'Review', 'Notification'],
    actionCodes: ['CHAT_CREATED', 'MESSAGE_SENT', 'REVIEW_CREATED'],
  },
  {
    id: 'finanzas',
    path: 'finanzas',
    label: 'Finanzas',
    lead: 'Comisiones, liquidaciones y movimientos contables del sistema.',
    defaultEntityType: '',
    entityTypes: [],
    actionCodes: [],
  },
];

export function getAuditSection(path: string): AuditSectionConfig | undefined {
  return AUDIT_SECTIONS.find((s) => s.path === path);
}
