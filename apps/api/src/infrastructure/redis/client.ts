import { createClient, type RedisClientType } from 'redis';

import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL?.trim());
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  const url = env.REDIS_URL?.trim();
  if (!url) return null;
  if (client?.isOpen) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const next = createClient({ url }) as RedisClientType;
      next.on('error', (error) => {
        logger.warn('redis client error', { error });
      });
      await next.connect();
      client = next;
      logger.info('redis connected');
      return client;
    } catch (error) {
      logger.error('redis connect failed — falling back to in-memory rate limits', { error });
      client = null;
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export async function redisGet(key: string): Promise<string | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  return redis.get(key);
}

export async function redisSet(
  key: string,
  value: string,
  ttlMs: number,
): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  await redis.set(key, value, { PX: ttlMs });
  return true;
}

export async function redisIncrWithTtl(key: string, ttlMs: number): Promise<number | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pExpire(key, ttlMs);
  }
  return count;
}
