import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IChat } from '../interfaces/chat.interface';
import { ChatChannel, ChatType } from '../types/enums';

export type ChatDocument = HydratedDocument<IChat>;

const chatSchema = new Schema<IChat>(
  {
    type: {
      type: String,
      enum: Object.values(ChatType),
      default: ChatType.TRANSACTION,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(ChatChannel),
      index: true,
    },
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (value: unknown[]) =>
          Array.isArray(value) && value.length >= 2 && value.length <= 10,
        message: 'Un chat debe tener entre 2 y 10 participantes',
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, trim: true, maxlength: 280 },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'chats',
  },
);

chatSchema.index({ participants: 1, lastMessageAt: -1 });
chatSchema.index(
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

export const ChatModel: Model<IChat> = model<IChat>('Chat', chatSchema);
