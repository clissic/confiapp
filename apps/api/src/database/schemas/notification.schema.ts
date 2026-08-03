import { Schema } from 'mongoose';
import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
  type INotification,
} from '@confiapp/database';

export const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user is required'],
    },
    type: {
      type: String,
      enum: {
        values: Object.values(NotificationType),
        message: 'Invalid notification type',
      },
      required: true,
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      default: NotificationChannel.IN_APP,
    },
    channelsDelivered: {
      type: [String],
      enum: Object.values(NotificationChannel),
      default: [],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    data: { type: Schema.Types.Mixed },
    entityType: { type: String, trim: true, maxlength: 64 },
    entityId: { type: Schema.Types.ObjectId },
    actionStatus: {
      type: String,
      enum: Object.values(NotificationActionStatus),
    },
    expiresAt: { type: Date },
    respondedAt: { type: Date },
    reassignedFrom: { type: Schema.Types.ObjectId, ref: 'Notification' },
    readAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'notifications' },
);
