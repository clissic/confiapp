import type { Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

import { getRedisClient, isRedisConfigured } from '../infrastructure/redis/client';
import { logger } from '../utils/logger';

type StoreFactory = NonNullable<Options['store']>;

/**
 * Store Redis compartido entre réplicas. Si no hay REDIS_URL, express-rate-limit
 * usa el MemoryStore por defecto.
 */
export function createRateLimitStore(prefix: string): StoreFactory | undefined {
  if (!isRedisConfigured()) return undefined;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: async (...args: string[]): Promise<RedisReply> => {
      const client = await getRedisClient();
      if (!client) {
        throw new Error('Redis unavailable for rate limit store');
      }
      return client.sendCommand(args as [string, ...string[]]) as Promise<RedisReply>;
    },
  }) as unknown as StoreFactory;
}

export function logRateLimitBackend(): void {
  if (isRedisConfigured()) {
    logger.info('rate limits using Redis store');
  } else {
    logger.info('rate limits using in-memory store (set REDIS_URL for multi-replica)');
  }
}
