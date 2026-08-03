import type { Schema } from 'mongoose';
import type { IAgentAvailability } from '@confiapp/database';

export function applyAgentAvailabilityIndexes(schema: Schema<IAgentAvailability>): void {
  schema.index({ isAcceptingAssignments: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ isAcceptingAssignments: 1, deletedAt: 1 });
}
