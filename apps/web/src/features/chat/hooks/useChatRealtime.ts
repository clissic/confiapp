import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  connectRealtimeSocket,
  getRealtimeSocket,
  releaseRealtimeSocket,
} from '@/shared/realtime/socket';

import { chatMessagesQueryKey, chatsQueryKey } from './useChat';
import type { ChatMessage } from '../model/types';

function currentUserId(): string {
  const token = localStorage.getItem('accessToken');
  if (!token) return 'demo-agent';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { sub?: string };
    return payload.sub || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Socket de chat: mensajes, typing, leídos, notificaciones y re-join al reconectar. */
export function useChatRealtime(activeChatId: string | null) {
  const queryClient = useQueryClient();
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    'offline' | 'connecting' | 'online' | 'reconnecting'
  >('offline');
  const activeRef = useRef(activeChatId);
  const prevChatRef = useRef<string | null>(null);
  activeRef.current = activeChatId;
  const me = currentUserId();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setConnectionState('offline');
      return;
    }

    const socket = connectRealtimeSocket(token);
    setConnectionState(socket.connected ? 'online' : 'connecting');

    const joinActive = () => {
      const chatId = activeRef.current;
      if (chatId) socket.emit('join:chat', chatId);
    };

    const onConnect = () => {
      setConnectionState('online');
      joinActive();
    };
    const onDisconnect = () => setConnectionState('reconnecting');
    const onReconnectAttempt = () => setConnectionState('reconnecting');

    const onMessageNew = (message: ChatMessage) => {
      void queryClient.invalidateQueries({ queryKey: chatsQueryKey });
      void queryClient.invalidateQueries({
        queryKey: chatMessagesQueryKey(message.chatId),
      });
    };

    const onTyping = (payload: {
      chatId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (payload.chatId !== activeRef.current) return;
      if (payload.userId === me) return;
      setTypingUserId(payload.isTyping ? payload.userId : null);
    };

    const onRead = (payload: { chatId: string }) => {
      void queryClient.invalidateQueries({
        queryKey: chatMessagesQueryKey(payload.chatId),
      });
    };

    const onNotify = () => {
      void queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('message:new', onMessageNew);
    socket.on('typing:update', onTyping);
    socket.on('message:read', onRead);
    socket.on('chat:notify', onNotify);
    socket.on('notification:new', onNotify);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('message:new', onMessageNew);
      socket.off('typing:update', onTyping);
      socket.off('message:read', onRead);
      socket.off('chat:notify', onNotify);
      socket.off('notification:new', onNotify);
      if (activeRef.current) socket.emit('leave:chat', activeRef.current);
      releaseRealtimeSocket();
    };
  }, [queryClient, me]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    if (prevChatRef.current && prevChatRef.current !== activeChatId) {
      socket.emit('leave:chat', prevChatRef.current);
      setTypingUserId(null);
    }
    if (activeChatId) {
      socket.emit('join:chat', activeChatId);
    }
    prevChatRef.current = activeChatId;
  }, [activeChatId]);

  return { typingUserId, connectionState, me };
}

export function emitTyping(chatId: string, isTyping: boolean): void {
  const socket = getRealtimeSocket();
  if (!socket?.connected) return;
  socket.emit(isTyping ? 'typing:start' : 'typing:stop', chatId);
}

export function emitMarkRead(chatId: string, messageIds?: string[]): void {
  const socket = getRealtimeSocket();
  if (!socket?.connected) return;
  socket.emit('message:read', { chatId, messageIds });
}
