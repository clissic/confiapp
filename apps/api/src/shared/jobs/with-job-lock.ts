import { randomUUID } from 'node:crypto';

import { JobLockModel } from '../../database/models/job-lock.model';
import { logger } from '../../utils/logger';

/**
 * Ejecuta `fn` solo si se adquiere el lock `key` (Mongo + TTL).
 * Si otro proceso tiene el lock, no-op y retorna null.
 */
export async function withJobLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const owner = randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(1_000, ttlMs));
  let acquired = false;

  try {
    await JobLockModel.create({ key, owner, expiresAt });
    acquired = true;
  } catch {
    const stolen = await JobLockModel.findOneAndUpdate(
      { key, expiresAt: { $lte: new Date() } },
      { $set: { owner, expiresAt } },
      { new: true },
    ).exec();
    acquired = Boolean(stolen && stolen.owner === owner);
  }

  if (!acquired) return null;

  try {
    return await fn();
  } finally {
    try {
      await JobLockModel.deleteOne({ key, owner }).exec();
    } catch (error) {
      logger.warn('job lock release failed', { key, error });
    }
  }
}
