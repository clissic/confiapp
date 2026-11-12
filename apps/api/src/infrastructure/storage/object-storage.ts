import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

import { storageEnv } from '../../shared/config/env';
import { AppError, ValidationError } from '../../shared/errors/app-error';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export type MediaPurpose = 'chat' | 'kyc' | 'product' | 'receipt' | 'profile';

const MAX_BYTES: Record<MediaPurpose, number> = {
  chat: 2 * 1024 * 1024,
  kyc: 5 * 1024 * 1024,
  product: 3 * 1024 * 1024,
  receipt: 5 * 1024 * 1024,
  profile: 3 * 1024 * 1024,
};

let s3: S3Client | null = null;

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    storageEnv.endpoint &&
      storageEnv.bucket &&
      storageEnv.accessKeyId &&
      storageEnv.secretAccessKey,
  );
}

function getClient(): S3Client {
  if (!isObjectStorageConfigured()) {
    throw new AppError(503, 'Object storage no configurado', undefined, 'STORAGE_NOT_CONFIGURED');
  }
  if (!s3) {
    s3 = new S3Client({
      region: storageEnv.region,
      endpoint: storageEnv.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storageEnv.accessKeyId,
        secretAccessKey: storageEnv.secretAccessKey,
      },
    });
  }
  return s3;
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'jpg';
  }
}

export function assertAllowedMime(contentType: string): void {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_MIME.has(mime)) {
    throw new ValidationError(`Tipo de archivo no permitido: ${mime || 'desconocido'}`);
  }
}

export function maxBytesForPurpose(purpose: MediaPurpose): number {
  return MAX_BYTES[purpose];
}

export async function createPresignedUpload(input: {
  userId: string;
  purpose: MediaPurpose;
  contentType: string;
  contentLength: number;
  fileName?: string;
}): Promise<{ storageKey: string; uploadUrl: string; headers: Record<string, string>; maxBytes: number }> {
  assertAllowedMime(input.contentType);
  const maxBytes = maxBytesForPurpose(input.purpose);
  if (input.contentLength <= 0 || input.contentLength > maxBytes) {
    throw new ValidationError(`El archivo supera el máximo de ${maxBytes} bytes`);
  }

  const mime = input.contentType.split(';')[0]!.trim().toLowerCase();
  const ext = extensionForMime(mime);
  const safeName = (input.fileName ?? `file.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storageKey = `${input.purpose}/${input.userId}/${Date.now()}-${randomUUID()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: storageEnv.bucket,
    Key: storageKey,
    ContentType: mime,
    ContentLength: input.contentLength,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 10 * 60 });
  return {
    storageKey,
    uploadUrl,
    headers: {
      'Content-Type': mime,
    },
    maxBytes,
  };
}

export async function headObject(storageKey: string): Promise<{
  contentLength?: number;
  contentType?: string;
}> {
  const result = await getClient().send(
    new HeadObjectCommand({
      Bucket: storageEnv.bucket,
      Key: storageKey,
    }),
  );
  return {
    contentLength: result.ContentLength,
    contentType: result.ContentType,
  };
}

export async function createPresignedGet(
  storageKey: string,
  expiresInSeconds = 15 * 60,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: storageEnv.bucket,
    Key: storageKey,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: storageEnv.bucket,
      Key: storageKey,
    }),
  );
}

export async function putObjectBuffer(input: {
  storageKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: storageEnv.bucket,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

export async function getObjectBuffer(storageKey: string): Promise<{
  body: Buffer;
  contentType: string;
}> {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: storageEnv.bucket,
      Key: storageKey,
    }),
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) {
    throw new AppError(404, 'Objeto no encontrado en storage', undefined, 'STORAGE_NOT_FOUND');
  }
  return {
    body: Buffer.from(bytes),
    contentType: result.ContentType ?? 'application/octet-stream',
  };
}

export function publicOrSignedHint(storageKey: string): string {
  const base = storageEnv.publicBaseUrl;
  if (base) {
    return `${base.replace(/\/$/, '')}/${storageKey}`;
  }
  return storageKey;
}
