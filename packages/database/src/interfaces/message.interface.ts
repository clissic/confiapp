import type { Types } from 'mongoose';

import type { MessageType } from '../types/enums';

export interface MessageAttachment {
  url: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileName?: string;
}

/**
 * Mensaje de un Chat. Colección separada (crecimiento no acotado).
 */
export interface IMessage {
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  type: MessageType;
  body: string;
  attachments: MessageAttachment[];
  /** Usuarios que marcaron el mensaje como leído. */
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
