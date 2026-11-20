import {
  createPresignedGet,
  isObjectStorageConfigured,
} from '../../infrastructure/storage/object-storage';

const STORAGE_URL_PREFIX = 'storage://';

export function storageKeyFromMediaRef(input: {
  url?: string;
  storageKey?: string;
}): string | undefined {
  const fromField = input.storageKey?.trim();
  if (fromField && fromField.length >= 3) return fromField;
  const url = input.url?.trim();
  if (!url?.startsWith(STORAGE_URL_PREFIX)) return undefined;
  const key = url.slice(STORAGE_URL_PREFIX.length).trim();
  return key.length >= 3 ? key : undefined;
}

/**
 * Convierte storage:// / storageKey a URL firmada https para el navegador.
 * Si no hay storage o falla el presign, devuelve la url original.
 */
export async function resolveMediaDisplayUrl(input: {
  url?: string;
  storageKey?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const original = input.url?.trim() ?? '';
  const key = storageKeyFromMediaRef(input);
  if (!key || !isObjectStorageConfigured()) {
    return original || (key ? `${STORAGE_URL_PREFIX}${key}` : '');
  }
  try {
    return await createPresignedGet(key, input.expiresInSeconds ?? 15 * 60);
  } catch {
    return original || `${STORAGE_URL_PREFIX}${key}`;
  }
}

export async function resolveMediaDisplayUrls<
  T extends { url?: string; storageKey?: string },
>(items: T[], expiresInSeconds?: number): Promise<Array<T & { url: string }>> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      url: await resolveMediaDisplayUrl({
        url: item.url,
        storageKey: item.storageKey,
        expiresInSeconds,
      }),
    })),
  );
}
