import type { Schema } from 'mongoose';

import type { ITransaction } from '@confiapp/database';

export function applyTransactionIndexes(schema: Schema<ITransaction>): void {
  schema.index({ status: 1 });
  schema.index({ createdBy: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ status: 1, createdAt: -1 });
  schema.index({ createdBy: 1, createdAt: -1 });
  schema.index({ product: 1, status: 1 });
  schema.index({ 'participants.user': 1, status: 1 });
  schema.index({ 'participants.user': 1, createdAt: -1 });
  schema.index({ inviteExpiresAt: 1 });
  schema.index({ status: 1, deletedAt: 1, createdAt: -1 });
  schema.index({ meetingLocation: '2dsphere' });
}
