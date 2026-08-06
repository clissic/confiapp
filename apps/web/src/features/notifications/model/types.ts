export type AppNotification = {
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
};

export type NotificationsListResponse = {
  items: AppNotification[];
  total: number;
  unreadCount: number;
};
