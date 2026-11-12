import { createHash } from 'node:crypto';

import { redisGet, redisSet } from '../../infrastructure/redis/client';
import { env } from '../config/env';

const memory = new Map<string, number>();

function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
}

/**
 * True si el email aún está en cooldown (no enviar otro mail).
 * Usa Redis si hay; si no, memoria del proceso.
 */
export async function isEmailInCooldown(email: string): Promise<boolean> {
  const key = `email-cd:${hashEmail(email)}`;
  const redisVal = await redisGet(key);
  if (redisVal) return true;

  const until = memory.get(key);
  if (until && until > Date.now()) return true;
  if (until) memory.delete(key);
  return false;
}

export async function markEmailCooldown(email: string): Promise<void> {
  const key = `email-cd:${hashEmail(email)}`;
  const ttl = env.EMAIL_COOLDOWN_MS;
  const ok = await redisSet(key, '1', ttl);
  if (!ok) {
    memory.set(key, Date.now() + ttl);
  }
}
