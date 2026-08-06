import { apiClient } from '@/shared/api/client';

import type { AppNotification, NotificationsListResponse } from '../model/types';

export async function fetchNotifications(params?: {
  limit?: number;
  page?: number;
}): Promise<NotificationsListResponse> {
  const { data } = await apiClient.get<NotificationsListResponse>('/notifications', {
    params,
  });
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return data.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data } = await apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ modified: number }> {
  const { data } = await apiClient.post<{ modified: number }>('/notifications/read-all');
  return data;
}

/** Deep-link preferido desde data.href o por tipo/entidad. */
export function notificationHref(n: AppNotification): string | null {
  const href = n.data?.href;
  if (typeof href === 'string' && href.startsWith('/')) return href;

  const chatId = n.data?.chatId;
  if (typeof chatId === 'string') return `/mensajes?chat=${chatId}`;

  const code = n.data?.transactionCode;
  if (typeof code === 'string') return `/operaciones/${code}`;

  if (n.type === 'AGENT_ASSIGNMENT') return '/agente/ofertas';
  if (n.entityType === 'Transaction' && typeof n.data?.transactionId === 'string') {
    return '/operaciones';
  }

  return null;
}
