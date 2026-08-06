import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { connectRealtimeSocket, releaseRealtimeSocket } from '@/shared/realtime/socket';

import { notificationsQueryKey, notificationsUnreadQueryKey } from './useNotifications';

/** Invalida inbox/unread ante notification:new y notification:updated. */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectRealtimeSocket(token);

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationsUnreadQueryKey });
    };

    socket.on('notification:new', invalidate);
    socket.on('notification:updated', invalidate);

    return () => {
      socket.off('notification:new', invalidate);
      socket.off('notification:updated', invalidate);
      releaseRealtimeSocket();
    };
  }, [queryClient]);
}
