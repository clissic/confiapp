import { NotificationChannel } from '@confiapp/database';

import { logger } from '../../utils/logger';

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Proveedor Push (FCM/APNs). Stub: registra el intento para canal PUSH.
 * Cuando haya device tokens, aquí irá el envío real.
 */
export class PushNotificationProvider {
  async send(payload: PushPayload): Promise<{ delivered: boolean; provider: 'stub' }> {
    logger.info('push notification stub', {
      userId: payload.userId,
      title: payload.title,
      channel: NotificationChannel.PUSH,
    });
    return { delivered: true, provider: 'stub' };
  }
}

export const pushProvider = new PushNotificationProvider();
