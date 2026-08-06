import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
  type INotification,
} from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';

import { ValidationError } from '../../shared/errors/app-error';
import {
  NotificationsService,
  notificationsService,
} from '../notifications/service';

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

/** Ofertas de agente: delega en NotificationsService (transactionUpdates + canales). */
export class NotificationDeliveryService {
  constructor(private readonly notifications: NotificationsService = notificationsService) {}

  async createAndDeliverOffer(
    input: CreateOfferNotificationInput,
  ): Promise<NotificationDocument> {
    const doc = await this.notifications.notify({
      userId: input.userId,
      type: NotificationType.AGENT_ASSIGNMENT,
      title: input.title,
      body: input.body,
      data: input.data,
      entityType: 'Transaction',
      entityId: input.entityId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      actionStatus: NotificationActionStatus.PENDING,
      expiresAt: input.expiresAt,
      reassignedFrom: input.reassignedFrom,
      extraRealtimeEvents: ['agent:offer'],
    });

    if (!doc) {
      throw new ValidationError(
        'El agente tiene desactivadas las notificaciones de operaciones o los canales in-app/push',
      );
    }

    return doc;
  }

  async emitUpdate(userId: string, notification: NotificationDocument): Promise<void> {
    await this.notifications.emitUpdate(userId, notification, ['agent:offer:updated']);
  }
}
