import { Schema } from 'mongoose';
import { ChatChannel, ChatType, type IChat } from '@confiapp/database';

export const chatSchema = new Schema<IChat>(
  {
    type: {
      type: String,
      enum: Object.values(ChatType),
      default: ChatType.TRANSACTION,
    },
    channel: {
      type: String,
      enum: Object.values(ChatChannel),
    },
    transaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
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
      required: [true, 'createdBy is required'],
    },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, trim: true, maxlength: 280 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'chats' },
);
