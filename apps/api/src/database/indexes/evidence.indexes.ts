import type { Schema } from 'mongoose';

import type { IEvidence } from '@confiapp/database';

export function applyEvidenceIndexes(schema: Schema<IEvidence>): void {
  schema.index({ transaction: 1 });
  schema.index({ uploadedBy: 1 });
  schema.index({ type: 1 });
  schema.index({ status: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ transaction: 1, createdAt: -1 });
  schema.index({ transaction: 1, status: 1 });
}
