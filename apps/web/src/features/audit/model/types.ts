export interface AuditLogItem {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  correlationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditListResponse {
  items: AuditLogItem[];
}
