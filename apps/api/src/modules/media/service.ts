import {
  createPresignedGet,
  createPresignedUpload,
  headObject,
  isObjectStorageConfigured,
  maxBytesForPurpose,
  type MediaPurpose,
} from '../../infrastructure/storage/object-storage';
import { redisIncrWithTtl } from '../../infrastructure/redis/client';
import { env } from '../../shared/config/env';
import { AppError, ForbiddenError, ValidationError } from '../../shared/errors/app-error';

const DAILY_UPLOAD_MAX = 80;
const memoryDaily = new Map<string, { count: number; resetAt: number }>();

async function assertDailyQuota(userId: string): Promise<void> {
  const key = `media:uploads:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const redisCount = await redisIncrWithTtl(key, 24 * 60 * 60_000);
  if (redisCount !== null) {
    if (redisCount > DAILY_UPLOAD_MAX) {
      throw new ValidationError('Alcanzaste el límite diario de subidas');
    }
    return;
  }

  const now = Date.now();
  const entry = memoryDaily.get(userId);
  if (!entry || entry.resetAt <= now) {
    memoryDaily.set(userId, { count: 1, resetAt: now + 24 * 60 * 60_000 });
    return;
  }
  if (entry.count >= DAILY_UPLOAD_MAX) {
    throw new ValidationError('Alcanzaste el límite diario de subidas');
  }
  entry.count += 1;
}

function assertKeyOwnedByUser(storageKey: string, userId: string): void {
  const parts = storageKey.split('/');
  // purpose/userId/...
  if (parts.length < 3 || parts[1] !== userId) {
    throw new ForbiddenError('storageKey inválido para este usuario');
  }
}

export class MediaService {
  status() {
    return {
      configured: isObjectStorageConfigured(),
      requireObjectKeys: env.STORAGE_REQUIRE_OBJECT_KEYS,
    };
  }

  async presign(
    userId: string,
    input: {
      purpose: MediaPurpose;
      contentType: string;
      contentLength: number;
      fileName?: string;
    },
  ) {
    if (!isObjectStorageConfigured()) {
      throw new AppError(503, 'Object storage no configurado', undefined, 'STORAGE_NOT_CONFIGURED');
    }
    await assertDailyQuota(userId);
    return createPresignedUpload({
      userId,
      purpose: input.purpose,
      contentType: input.contentType,
      contentLength: input.contentLength,
      fileName: input.fileName,
    });
  }

  async confirm(
    userId: string,
    input: { storageKey: string; purpose: MediaPurpose },
  ) {
    if (!isObjectStorageConfigured()) {
      throw new AppError(503, 'Object storage no configurado', undefined, 'STORAGE_NOT_CONFIGURED');
    }
    assertKeyOwnedByUser(input.storageKey, userId);
    if (!input.storageKey.startsWith(`${input.purpose}/`)) {
      throw new ValidationError('purpose no coincide con storageKey');
    }

    const head = await headObject(input.storageKey);
    const max = maxBytesForPurpose(input.purpose);
    if (!head.contentLength || head.contentLength > max) {
      throw new ValidationError('Archivo inválido o demasiado grande');
    }

    return {
      storageKey: input.storageKey,
      contentType: head.contentType,
      sizeBytes: head.contentLength,
      ok: true as const,
    };
  }

  async signedUrl(userId: string, storageKey: string) {
    if (!isObjectStorageConfigured()) {
      throw new AppError(503, 'Object storage no configurado', undefined, 'STORAGE_NOT_CONFIGURED');
    }
    assertKeyOwnedByUser(storageKey, userId);
    const url = await createPresignedGet(storageKey);
    return { url, expiresInSeconds: 15 * 60 };
  }
}

export const mediaService = new MediaService();
