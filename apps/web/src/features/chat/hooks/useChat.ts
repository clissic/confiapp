import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listChats,
  listMessages,
  markChatRead,
  sendMessage,
} from '../api/chat.api';
import type { MessageAttachment } from '../model/types';

export const chatsQueryKey = ['chats'] as const;
export const chatMessagesQueryKey = (chatId: string) =>
  ['chats', chatId, 'messages'] as const;

export function useChats() {
  return useQuery({
    queryKey: chatsQueryKey,
    queryFn: listChats,
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: chatMessagesQueryKey(chatId ?? ''),
    queryFn: () => listMessages(chatId!),
    enabled: Boolean(chatId),
  });
}

export function useSendChatMessage(chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body?: string; attachments?: MessageAttachment[] }) =>
      sendMessage(chatId!, input),
    onSuccess: () => {
      if (!chatId) return;
      void queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(chatId) });
      void queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
  });
}

export function useMarkChatRead(chatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageIds?: string[]) => markChatRead(chatId!, messageIds),
    onSuccess: () => {
      if (!chatId) return;
      void queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(chatId) });
      void queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
  });
}
