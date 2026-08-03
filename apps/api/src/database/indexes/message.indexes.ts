import type { Schema } from 'mongoose';
import type { IMessage } from '@confiapp/database';

export function applyMessageIndexes(schema: Schema<IMessage>): void {
  schema.index({ chat: 1 });
  schema.index({ sender: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ chat: 1, createdAt: -1 });
  schema.index({ chat: 1, deletedAt: 1, createdAt: -1 });
}
