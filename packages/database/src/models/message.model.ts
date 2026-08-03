import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IMessage } from '../interfaces/message.interface';
import { MessageType } from '../types/enums';

export type MessageDocument = HydratedDocument<IMessage>;

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    storageKey: { type: String, trim: true, maxlength: 512 },
    mimeType: { type: String, trim: true, maxlength: 128 },
    sizeBytes: { type: Number, min: 0 },
    fileName: { type: String, trim: true, maxlength: 255 },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10_000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 10,
        message: 'Máximo 10 adjuntos por mensaje',
      },
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'messages',
  },
);

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ chat: 1, deletedAt: 1, createdAt: -1 });

export const MessageModel: Model<IMessage> = model<IMessage>('Message', messageSchema);
