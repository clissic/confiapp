import type { Schema } from 'mongoose';
import type { INotification } from '@confiapp/database';

export function applyNotificationIndexes(schema: Schema<INotification>): void {
  schema.index({ user: 1 });
  schema.index({ type: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ user: 1, createdAt: -1 });
  schema.index({ user: 1, readAt: 1, createdAt: -1 });
  schema.index({ entityType: 1, entityId: 1 });
  schema.index({ actionStatus: 1, expiresAt: 1 });
  schema.index({ type: 1, actionStatus: 1, expiresAt: 1 });
}
