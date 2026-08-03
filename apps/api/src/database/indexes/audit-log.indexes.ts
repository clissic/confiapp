import type { Schema } from 'mongoose';

import type { IAuditLog } from '@confiapp/database';

export function applyAuditLogIndexes(schema: Schema<IAuditLog>): void {
  schema.index({ actor: 1 });
  schema.index({ action: 1 });
  schema.index({ entityType: 1 });
  schema.index({ entityId: 1 });
  schema.index({ outcome: 1 });
  schema.index({ correlationId: 1 });
  schema.index({ entityType: 1, entityId: 1, createdAt: -1 });
  schema.index({ actor: 1, createdAt: -1 });
  schema.index({ action: 1, createdAt: -1 });
  schema.index({ createdAt: -1 });
  schema.index({ correlationId: 1, createdAt: -1 });
}
