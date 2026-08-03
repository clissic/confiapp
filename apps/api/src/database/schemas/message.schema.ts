import { Schema } from 'mongoose';
import { MessageType, type IMessage } from '@confiapp/database';

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

export const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: [true, 'chat is required'],
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sender is required'],
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    body: {
      type: String,
      required: [true, 'body is required'],
      trim: true,
      maxlength: [10_000, 'body is too long'],
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
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'messages' },
);
