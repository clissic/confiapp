import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
  type INotification,
} from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';

import { NotificationModel, UserModel } from '../../database/models';
import { pushProvider } from '../../infrastructure/notifications/push.provider';
import { realtimeServer } from '../../infrastructure/realtime/socket-realtime.server';

export type NotificationDocument = HydratedDocument<INotification>;

export interface CreateOfferNotificationInput {
  userId: string;
  title: string;
  body: string;
  entityId: string;
  expiresAt: Date;
  data: Record<string, unknown>;
  reassignedFrom?: string;
}

export class NotificationDeliveryService {
  async createAndDeliverOffer(
    input: CreateOfferNotificationInput,
  ): Promise<NotificationDocument> {
    const user = await UserModel.findById(input.userId)
      .select('preferences.notifications')
      .lean()
      .exec();

    const prefs = user?.preferences?.notifications;
    const channels: NotificationChannel[] = [NotificationChannel.IN_APP];

    if (prefs?.push !== false) {
      channels.push(NotificationChannel.PUSH);
    }

    const doc = await NotificationModel.create({
      user: input.userId,
      type: NotificationType.AGENT_ASSIGNMENT,
      channel: NotificationChannel.IN_APP,
      channelsDelivered: channels,
      title: input.title,
      body: input.body,
      data: input.data,
      entityType: 'Transaction',
      entityId: input.entityId,
      actionStatus: NotificationActionStatus.PENDING,
      expiresAt: input.expiresAt,
      reassignedFrom: input.reassignedFrom,
    });

    const payload = {
      id: String(doc._id),
      type: doc.type,
      title: doc.title,
      body: doc.body,
      actionStatus: doc.actionStatus,
      expiresAt: doc.expiresAt?.toISOString(),
      data: doc.data,
      entityType: doc.entityType,
      entityId: doc.entityId ? String(doc.entityId) : undefined,
      createdAt: doc.createdAt.toISOString(),
    };

    realtimeServer.publishToUser(input.userId, 'notification:new', payload);
    realtimeServer.publishToUser(input.userId, 'agent:offer', payload);

    if (channels.includes(NotificationChannel.PUSH)) {
      await pushProvider.send({
        userId: input.userId,
        title: input.title,
        body: input.body,
        data: {
          notificationId: String(doc._id),
          ...input.data,
        },
      });
    }

    return doc;
  }

  async emitUpdate(userId: string, notification: NotificationDocument): Promise<void> {
    const payload = {
      id: String(notification._id),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actionStatus: notification.actionStatus,
      expiresAt: notification.expiresAt?.toISOString(),
      data: notification.data,
      respondedAt: notification.respondedAt?.toISOString(),
      entityId: notification.entityId ? String(notification.entityId) : undefined,
    };
    realtimeServer.publishToUser(userId, 'notification:updated', payload);
    realtimeServer.publishToUser(userId, 'agent:offer:updated', payload);
  }
}
