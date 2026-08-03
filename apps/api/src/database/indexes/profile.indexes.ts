import type { Schema } from 'mongoose';

import type { IProfile } from '@confiapp/database';

export function applyProfileIndexes(schema: Schema<IProfile>): void {
  schema.index({ user: 1 }, { unique: true });
  schema.index({ deletedAt: 1 });
  schema.index({ displayName: 'text' });
  schema.index({ createdAt: -1 });
}
