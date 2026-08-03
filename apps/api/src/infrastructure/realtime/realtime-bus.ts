import { logger } from '../../utils/logger';
import { userRoom } from './rooms';

type PublishFn = (room: string, event: string, payload: unknown) => void;

let publishImpl: PublishFn | null = null;

export function bindRealtimePublisher(fn: PublishFn): void {
  publishImpl = fn;
}

export function unbindRealtimePublisher(): void {
  publishImpl = null;
}

export function publishRealtime(room: string, event: string, payload: unknown): void {
  if (!publishImpl) {
    logger.debug('realtime publish skipped (not bound)', { room, event });
    return;
  }
  publishImpl(room, event, payload);
}

export function publishRealtimeToUser(
  userId: string,
  event: string,
  payload: unknown,
): void {
  publishRealtime(userRoom(userId), event, payload);
}
