import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { INotification } from '@confiapp/database';

import { applyNotificationIndexes } from '../indexes/notification.indexes';
import { notificationSchema } from '../schemas/notification.schema';

export type NotificationDocument = HydratedDocument<INotification>;

applyNotificationIndexes(notificationSchema);

export const NotificationModel: Model<INotification> =
  (models.Notification as Model<INotification> | undefined) ??
  model<INotification>('Notification', notificationSchema);
