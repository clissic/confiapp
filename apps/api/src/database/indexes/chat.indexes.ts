import type { Schema } from 'mongoose';
import type { IChat } from '@confiapp/database';

export function applyChatIndexes(schema: Schema<IChat>): void {
  schema.index({ type: 1 });
  schema.index({ channel: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ participants: 1, lastMessageAt: -1 });
  schema.index(
    { transaction: 1, channel: 1 },
    {
      unique: true,
      partialFilterExpression: {
        transaction: { $type: 'objectId' },
        channel: { $type: 'string' },
        deletedAt: null,
      },
    },
  );
}
