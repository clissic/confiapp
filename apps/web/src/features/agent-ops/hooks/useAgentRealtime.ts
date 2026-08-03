import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { connectRealtimeSocket, releaseRealtimeSocket } from '@/shared/realtime/socket';

import { agentOffersQueryKey } from './useAgentOps';

/** Suscribe ofertas de agente en tiempo real vía WebSocket. */
export function useAgentRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectRealtimeSocket(token);

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: agentOffersQueryKey });
    };

    socket.on('notification:new', invalidate);
    socket.on('notification:updated', invalidate);
    socket.on('agent:offer', invalidate);
    socket.on('agent:offer:updated', invalidate);
    socket.on('agent:reassigned', invalidate);

    return () => {
      socket.off('notification:new', invalidate);
      socket.off('notification:updated', invalidate);
      socket.off('agent:offer', invalidate);
      socket.off('agent:offer:updated', invalidate);
      socket.off('agent:reassigned', invalidate);
      releaseRealtimeSocket();
    };
  }, [queryClient]);
}
