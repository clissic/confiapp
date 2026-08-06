import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
  type INotification,
} from '@confiapp/database';
import { Types, type HydratedDocument } from 'mongoose';

import { NotificationModel, UserModel } from '../../database/models';
import { emailSender } from '../../infrastructure/email/email.sender';
import { pushProvider } from '../../infrastructure/notifications/push.provider';
import { publishRealtimeToUser } from '../../infrastructure/realtime/realtime-bus';
import { NotFoundError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';

import { resolveDelivery } from './resolve-delivery';

export type NotificationDocument = HydratedDocument<INotification>;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  channels?: NotificationChannel[];
  actionStatus?: NotificationActionStatus;
  expiresAt?: Date;
  reassignedFrom?: string;
  /** Eventos socket adicionales tras `notification:new` (p. ej. agent:offer). */
  extraRealtimeEvents?: string[];
}

export interface NotificationDto {
  id: string;
  type: string;
  channel: string;
  channelsDelivered: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  actionStatus?: string;
  expiresAt?: string;
  readAt?: string;
  createdAt: string;
}

export class NotificationsService {
  /**
   * Crea y entrega una notificación respetando preferences.notifications.
   * Si categoría OFF o ningún canal queda → no crea documento y retorna null.
   */
  async notify(input: NotifyInput): Promise<NotificationDocument | null> {
    const user = await UserModel.findById(input.userId)
      .select('email preferences.notifications')
      .lean()
      .exec();

    const prefs = user?.preferences?.notifications;
    const delivery = resolveDelivery(prefs, input.type, input.channels);

    if (delivery.skip) {
      logger.debug('notification.skipped', {
        userId: input.userId,
        type: input.type,
        reason: delivery.reason,
      });
      return null;
    }

    const doc = await NotificationModel.create({
      user: input.userId,
      type: input.type,
      channel: delivery.primary,
      channelsDelivered: delivery.channels,
      title: input.title,
      body: input.body,
      data: input.data,
      entityType: input.entityType,
      entityId: input.entityId,
      actionStatus: input.actionStatus,
      expiresAt: input.expiresAt,
      reassignedFrom: input.reassignedFrom,
    });

    const payload = this.toRealtimePayload(doc);

    publishRealtimeToUser(input.userId, 'notification:new', payload);
    for (const event of input.extraRealtimeEvents ?? []) {
      publishRealtimeToUser(input.userId, event, payload);
    }

    if (delivery.channels.includes(NotificationChannel.PUSH)) {
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

    if (delivery.channels.includes(NotificationChannel.EMAIL) && user?.email) {
      try {
        await emailSender.send({
          to: user.email,
          subject: input.title,
          text: input.body,
          html: `<p>${escapeHtml(input.body)}</p>`,
        });
      } catch (error) {
        logger.warn('notification.email_failed', {
          userId: input.userId,
          notificationId: String(doc._id),
          error,
        });
      }
    }

    return doc;
  }

  async emitUpdate(
    userId: string,
    notification: NotificationDocument,
    extraRealtimeEvents: string[] = ['agent:offer:updated'],
  ): Promise<void> {
    const payload = {
      ...this.toRealtimePayload(notification),
      respondedAt: notification.respondedAt?.toISOString(),
    };
    publishRealtimeToUser(userId, 'notification:updated', payload);
    for (const event of extraRealtimeEvents) {
      publishRealtimeToUser(userId, event, payload);
    }
  }

  async listForUser(
    userId: string,
    opts: { limit?: number; page?: number } = {},
  ): Promise<{ items: NotificationDto[]; total: number; unreadCount: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const page = Math.max(opts.page ?? 1, 1);
    const filter = { user: userId, deletedAt: null };

    const [total, unreadCount, docs] = await Promise.all([
      NotificationModel.countDocuments(filter).exec(),
      NotificationModel.countDocuments({ ...filter, readAt: null }).exec(),
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      items: docs.map((d) => this.toDto(d)),
      total,
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      user: userId,
      deletedAt: null,
      readAt: null,
    }).exec();
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new NotFoundError('Notificación no encontrada');
    }

    const doc = await NotificationModel.findOne({
      _id: notificationId,
      user: userId,
      deletedAt: null,
    }).exec();

    if (!doc) {
      throw new NotFoundError('Notificación no encontrada');
    }

    if (!doc.readAt) {
      doc.readAt = new Date();
      await doc.save();
      await this.emitUpdate(userId, doc, []);
    }

    return this.toDto(doc);
  }

  async markAllRead(userId: string): Promise<{ modified: number }> {
    const result = await NotificationModel.updateMany(
      { user: userId, deletedAt: null, readAt: null },
      { $set: { readAt: new Date() } },
    ).exec();

    return { modified: result.modifiedCount };
  }

  toDto(
    doc:
      | NotificationDocument
      | (INotification & { _id: Types.ObjectId }),
  ): NotificationDto {
    return {
      id: String(doc._id),
      type: doc.type,
      channel: doc.channel,
      channelsDelivered: doc.channelsDelivered ?? [],
      title: doc.title,
      body: doc.body,
      data: doc.data,
      entityType: doc.entityType,
      entityId: doc.entityId ? String(doc.entityId) : undefined,
      actionStatus: doc.actionStatus,
      expiresAt: doc.expiresAt?.toISOString(),
      readAt: doc.readAt?.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private toRealtimePayload(doc: NotificationDocument) {
    return {
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
      readAt: doc.readAt?.toISOString(),
    };
  }
}

export const notificationsService = new NotificationsService();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
