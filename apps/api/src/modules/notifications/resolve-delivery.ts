import {
  NotificationChannel,
  NotificationType,
  type UserNotificationPreferences,
} from '@confiapp/database';

export type NotificationPrefs = Partial<UserNotificationPreferences> | null | undefined;

export type DeliveryResolution =
  | { skip: true; reason: 'category_off' | 'no_channels' }
  | {
      skip: false;
      channels: NotificationChannel[];
      primary: NotificationChannel;
    };

const DEFAULT_CHANNELS: NotificationChannel[] = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
];

/** ¿La categoría (tema) de preferencias está habilitada para este tipo? */
export function isCategoryEnabled(
  prefs: NotificationPrefs,
  type: NotificationType,
): boolean {
  switch (type) {
    case NotificationType.MESSAGE:
      return prefs?.messageAlerts !== false;
    case NotificationType.AGENT_ASSIGNMENT:
    case NotificationType.TRANSACTION_UPDATE:
    case NotificationType.REVIEW:
      return prefs?.transactionUpdates !== false;
    case NotificationType.PAYMENT:
      return prefs?.paymentAlerts !== false;
    case NotificationType.DISPUTE:
      return prefs?.disputeAlerts !== false;
    case NotificationType.SYSTEM:
      // Seguridad / KYC / cuenta: no usa `marketing`; sin switch de categoría.
      return true;
    default:
      return true;
  }
}

function channelAllowed(prefs: NotificationPrefs, channel: NotificationChannel): boolean {
  switch (channel) {
    case NotificationChannel.IN_APP:
      return prefs?.inApp !== false;
    case NotificationChannel.PUSH:
      return prefs?.push !== false;
    case NotificationChannel.EMAIL:
      return prefs?.email !== false;
    default:
      return false;
  }
}

/**
 * Resuelve canales efectivos: categoría ON ∩ canales pedidos ∩ prefs de canal.
 * Tipos operativos/seguridad agregan EMAIL como candidato (el usuario puede
 * desactivarlo con preferences.notifications.email === false).
 * MESSAGE no fuerza email (ruido); el caller puede pedirlo.
 * SMS queda diferido (no existe en NotificationChannel).
 */
export function resolveDelivery(
  prefs: NotificationPrefs,
  type: NotificationType,
  requestedChannels: NotificationChannel[] = DEFAULT_CHANNELS,
): DeliveryResolution {
  if (!isCategoryEnabled(prefs, type)) {
    return { skip: true, reason: 'category_off' };
  }

  const candidates = [...requestedChannels];
  const shouldPreferEmail =
    type === NotificationType.SYSTEM ||
    type === NotificationType.TRANSACTION_UPDATE ||
    type === NotificationType.PAYMENT ||
    type === NotificationType.AGENT_ASSIGNMENT ||
    type === NotificationType.DISPUTE ||
    type === NotificationType.REVIEW;

  if (shouldPreferEmail && !candidates.includes(NotificationChannel.EMAIL)) {
    candidates.push(NotificationChannel.EMAIL);
  }

  const channels = candidates.filter((ch) => channelAllowed(prefs, ch));

  if (channels.length === 0) {
    return { skip: true, reason: 'no_channels' };
  }

  const primary = channels.includes(NotificationChannel.IN_APP)
    ? NotificationChannel.IN_APP
    : channels[0]!;

  return { skip: false, channels, primary };
}
