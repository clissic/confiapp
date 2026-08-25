export interface AuditLogItem {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Usuario asociado (actor o entidad User) para copiar al portapapeles. */
  userId?: string;
  /** Email de registro del usuario asociado. */
  userEmail?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  correlationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const AUDIT_PAGE_SIZE = 15;
