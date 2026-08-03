import type { Types } from 'mongoose';

import type { ChatChannel, ChatType } from '../types/enums';

/**
 * Conversación. En operaciones con agente hay 2 chats:
 * BUYER_AGENT y SELLER_AGENT (mismo transaction, distinto channel).
 */
export interface IChat {
  type: ChatType;
  /** Canal comprador↔agente o vendedor↔agente (requerido si type=TRANSACTION). */
  channel?: ChatChannel;
  transaction?: Types.ObjectId;
  participants: Types.ObjectId[];
  createdBy: Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
