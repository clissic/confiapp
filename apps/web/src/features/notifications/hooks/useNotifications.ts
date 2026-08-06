import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api';

export const notificationsQueryKey = ['notifications'] as const;
export const notificationsListQueryKey = ['notifications', 'list'] as const;
export const notificationsUnreadQueryKey = ['notifications', 'unread-count'] as const;
export const notificationsPreviewQueryKey = ['notifications', 'preview'] as const;

export function useNotificationsList() {
  return useQuery({
    queryKey: notificationsListQueryKey,
    queryFn: () => fetchNotifications({ limit: 50, page: 1 }),
  });
}

export function useNotificationsPreview() {
  return useQuery({
    queryKey: notificationsPreviewQueryKey,
    queryFn: () => fetchNotifications({ limit: 5, page: 1 }),
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: notificationsUnreadQueryKey,
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationsUnreadQueryKey });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationsUnreadQueryKey });
    },
  });
}
