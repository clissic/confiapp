import type { Schema } from 'mongoose';

import type { IDispute } from '@confiapp/database';

export function applyDisputeIndexes(schema: Schema<IDispute>): void {
  schema.index({ transaction: 1 });
  schema.index({ openedBy: 1 });
  schema.index({ assignedTo: 1 });
  schema.index({ status: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ transaction: 1, status: 1 });
  schema.index({ transaction: 1, createdAt: -1 });
  schema.index({ assignedTo: 1, status: 1 });
}
