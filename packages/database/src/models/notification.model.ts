import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { INotification } from '../interfaces/notification.interface';
import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
} from '../types/enums';

export type NotificationDocument = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
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
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    data: { type: Schema.Types.Mixed },
    entityType: { type: String, trim: true, maxlength: 64 },
    entityId: { type: Schema.Types.ObjectId },
    actionStatus: {
      type: String,
      enum: Object.values(NotificationActionStatus),
      index: true,
    },
    expiresAt: { type: Date, index: true },
    respondedAt: { type: Date },
    reassignedFrom: { type: Schema.Types.ObjectId, ref: 'Notification' },
    readAt: { type: Date },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'notifications',
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1 });
notificationSchema.index({ actionStatus: 1, expiresAt: 1 });
notificationSchema.index({ type: 1, actionStatus: 1, expiresAt: 1 });

export const NotificationModel: Model<INotification> = model<INotification>(
  'Notification',
  notificationSchema,
);
