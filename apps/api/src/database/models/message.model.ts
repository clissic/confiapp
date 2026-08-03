import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IMessage } from '@confiapp/database';

import { applyMessageIndexes } from '../indexes/message.indexes';
import { messageSchema } from '../schemas/message.schema';

export type MessageDocument = HydratedDocument<IMessage>;

applyMessageIndexes(messageSchema);

export const MessageModel: Model<IMessage> =
  (models.Message as Model<IMessage> | undefined) ??
  model<IMessage>('Message', messageSchema);
