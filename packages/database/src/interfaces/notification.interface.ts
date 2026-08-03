import type { Types } from 'mongoose';

import type {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
} from '../types/enums';

/**
 * Notificación dirigida a un usuario (in-app / email / push).
 * Las ofertas de agente usan actionStatus + expiresAt para aceptar/rechazar/reasignar.
 */
export interface INotification {
  user: Types.ObjectId;
  type: NotificationType;
  channel: NotificationChannel;
  /** Canales efectivamente despachados (IN_APP + PUSH, etc.). */
  channelsDelivered?: NotificationChannel[];
  title: string;
  body: string;
  /** Payload opaco para deep-link (ids, rutas, candidatos). */
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: Types.ObjectId;
  actionStatus?: NotificationActionStatus;
  expiresAt?: Date;
  respondedAt?: Date;
  /** Notificación previa supersedida al reasignar. */
  reassignedFrom?: Types.ObjectId;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
