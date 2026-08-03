import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { verifyAccessToken } from '../security/jwt';
import type { RealtimePublisherPort } from '../../application/ports/realtime-publisher.port';
import type { RealtimeServerPort } from './realtime.server';
import { registerChatSocketHandlers } from './chat-socket.handlers';
import {
  bindRealtimePublisher,
  unbindRealtimePublisher,
} from './realtime-bus';
import { chatRoom, transactionRoom, userRoom } from './rooms';
import { logger } from '../../utils/logger';
import { env } from '../../shared/config/env';

function socketCorsOrigin(): boolean | string | string[] | RegExp {
  if (env.NODE_ENV === 'production') {
    return env.CORS_ORIGIN.includes(',')
      ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
      : env.CORS_ORIGIN;
  }
  // Desarrollo: refleja cualquier origen (Local / LAN / túnel). En prod se restringe arriba.
  return true;
}

let io: Server | null = null;

export class SocketRealtimeServer implements RealtimeServerPort, RealtimePublisherPort {
  async start(httpServer: HttpServer): Promise<void> {
    if (io) return;

    io = new Server(httpServer, {
      cors: {
        origin: socketCorsOrigin(),
        credentials: true,
      },
      path: '/socket.io',
      pingInterval: 25_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 5e6,
    });

    bindRealtimePublisher((room, event, payload) => {
      io?.to(room).emit(event, payload);
    });

    io.use((socket, next) => {
      try {
        const token =
          (socket.handshake.auth?.token as string | undefined) ||
          (socket.handshake.query?.token as string | undefined);
        if (!token) {
          next(new Error('Unauthorized'));
          return;
        }
        const payload = verifyAccessToken(token);
        socket.data.userId = payload.sub;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });

    io.on('connection', (socket: Socket) => {
      const userId = String(socket.data.userId);
      void socket.join(userRoom(userId));
      logger.debug('socket connected', { userId, sid: socket.id });

      socket.on('join:transaction', (transactionId: string) => {
        if (typeof transactionId !== 'string' || transactionId.length === 0) return;
        void (async () => {
          try {
            const { TransactionModel } = await import('../../database/models');
            const { ParticipantStatus } = await import('@confiapp/database');
            const tx = await TransactionModel.findOne({
              _id: transactionId,
              deletedAt: null,
              $or: [
                { createdBy: userId },
                {
                  participants: {
                    $elemMatch: {
                      user: userId,
                      status: {
                        $in: [
                          ParticipantStatus.ACCEPTED,
                          ParticipantStatus.INVITED,
                        ],
                      },
                    },
                  },
                },
              ],
            })
              .select('_id')
              .lean()
              .exec();
            if (!tx) {
              socket.emit('error', { message: 'Forbidden transaction room' });
              return;
            }
            await socket.join(transactionRoom(transactionId));
          } catch (error) {
            logger.warn('join:transaction failed', { userId, transactionId, error });
          }
        })();
      });

      socket.on('leave:transaction', (transactionId: string) => {
        if (typeof transactionId === 'string') {
          void socket.leave(transactionRoom(transactionId));
        }
      });

      registerChatSocketHandlers(socket);

      socket.on('disconnect', (reason) => {
        logger.debug('socket disconnected', { userId, sid: socket.id, reason });
      });
    });

    logger.info('Socket.io realtime server started');
  }

  async stop(): Promise<void> {
    if (!io) return;
    unbindRealtimePublisher();
    await new Promise<void>((resolve) => {
      io?.close(() => resolve());
    });
    io = null;
  }

  publish(room: string, event: string, payload: unknown): void {
    if (!io) {
      logger.debug('realtime publish skipped (server not started)', { room, event });
      return;
    }
    io.to(room).emit(event, payload);
  }

  publishToUser(userId: string, event: string, payload: unknown): void {
    this.publish(userRoom(userId), event, payload);
  }
}

export const realtimeServer = new SocketRealtimeServer();

export { userRoom, transactionRoom, chatRoom };
