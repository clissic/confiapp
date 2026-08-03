import type { Socket } from 'socket.io';

import { ChatsService } from '../../modules/chats/service';
import { logger } from '../../utils/logger';
import { chatRoom } from './rooms';

const chatsService = new ChatsService();

/**
 * Registra handlers de chat en un socket autenticado.
 * Eventos: join/leave chat, message:send, typing, message:read.
 */
export function registerChatSocketHandlers(socket: Socket): void {
  const userId = String(socket.data.userId);

  socket.on('join:chat', async (chatId: unknown, ack?: (result: unknown) => void) => {
    try {
      if (typeof chatId !== 'string' || !chatId) {
        ack?.({ ok: false, error: 'chatId inválido' });
        return;
      }
      await chatsService.getChatForUser(userId, chatId);
      await socket.join(chatRoom(chatId));
      ack?.({ ok: true, chatId });
    } catch (error) {
      logger.debug('join:chat denied', { userId, chatId, error });
      ack?.({ ok: false, error: 'Sin acceso al chat' });
    }
  });

  socket.on('leave:chat', (chatId: unknown) => {
    if (typeof chatId === 'string' && chatId) {
      void socket.leave(chatRoom(chatId));
    }
  });

  socket.on(
    'message:send',
    async (payload: unknown, ack?: (result: unknown) => void) => {
      try {
        const data = payload as {
          chatId?: string;
          body?: string;
          attachments?: Array<{
            url: string;
            mimeType?: string;
            fileName?: string;
            sizeBytes?: number;
          }>;
        };
        if (!data?.chatId) {
          ack?.({ ok: false, error: 'chatId requerido' });
          return;
        }
        const message = await chatsService.sendMessage(userId, data.chatId, {
          body: data.body,
          attachments: data.attachments,
        });
        ack?.({ ok: true, message });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Error al enviar';
        ack?.({ ok: false, error: errMsg });
      }
    },
  );

  socket.on('typing:start', async (chatId: unknown) => {
    if (typeof chatId !== 'string' || !chatId) return;
    try {
      await chatsService.getChatForUser(userId, chatId);
      chatsService.emitTyping(userId, chatId, true);
    } catch {
      /* ignore */
    }
  });

  socket.on('typing:stop', async (chatId: unknown) => {
    if (typeof chatId !== 'string' || !chatId) return;
    try {
      await chatsService.getChatForUser(userId, chatId);
      chatsService.emitTyping(userId, chatId, false);
    } catch {
      /* ignore */
    }
  });

  socket.on(
    'message:read',
    async (payload: unknown, ack?: (result: unknown) => void) => {
      try {
        const data = payload as { chatId?: string; messageIds?: string[] };
        if (!data?.chatId) {
          ack?.({ ok: false, error: 'chatId requerido' });
          return;
        }
        const result = await chatsService.markRead(userId, data.chatId, data.messageIds);
        ack?.({ ok: true, ...result });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Error al marcar leído';
        ack?.({ ok: false, error: errMsg });
      }
    },
  );
}
