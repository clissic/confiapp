import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IChat } from '@confiapp/database';

import { applyChatIndexes } from '../indexes/chat.indexes';
import { chatSchema } from '../schemas/chat.schema';

export type ChatDocument = HydratedDocument<IChat>;

applyChatIndexes(chatSchema);

export const ChatModel: Model<IChat> =
  (models.Chat as Model<IChat> | undefined) ?? model<IChat>('Chat', chatSchema);
