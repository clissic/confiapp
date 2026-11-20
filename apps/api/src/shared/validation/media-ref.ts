import { z } from 'zod';

import { env } from '../config/env';

/** true cuando hay que rechazar data URLs grandes y exigir storageKey. */
export function mustUseObjectStorage(): boolean {
  return env.STORAGE_REQUIRE_OBJECT_KEYS;
}

const STORAGE_URL_PREFIX = 'storage://';

export function storageKeyFromUrl(url: string | undefined): string | undefined {
  if (!url?.startsWith(STORAGE_URL_PREFIX)) return undefined;
  const key = url.slice(STORAGE_URL_PREFIX.length).trim();
  return key.length >= 3 ? key : undefined;
}

function isAllowedMediaUrl(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) ||
    url.startsWith('data:image/') ||
    url.startsWith('data:application/pdf') ||
    url.startsWith(STORAGE_URL_PREFIX)
  );
}

/**
 * Adjunto: storageKey (preferido) o url http(s)/data: legacy / storage://key.
 * Con object storage configurado, data URLs quedan limitadas a 8KB (solo stubs).
 */
export function attachmentRefSchema(opts?: { maxDataUrlChars?: number }) {
  const maxData = mustUseObjectStorage() ? 8_192 : (opts?.maxDataUrlChars ?? 2_000_000);
  return z
    .object({
      url: z.string().trim().max(maxData).optional(),
      storageKey: z.string().trim().min(3).max(512).optional(),
      mimeType: z.string().trim().max(128).optional(),
      sizeBytes: z.number().min(0).optional(),
      fileName: z.string().trim().max(255).optional(),
      alt: z.string().trim().max(200).optional(),
    })
    .superRefine((value, ctx) => {
      const keyFromUrl = storageKeyFromUrl(value.url);
      const hasKey = Boolean(value.storageKey || keyFromUrl);
      const hasUrl = Boolean(value.url);
      if (!hasKey && !hasUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Falta storageKey o url',
        });
        return;
      }
      if (mustUseObjectStorage() && !hasKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subí el archivo al storage (storageKey requerido)',
          path: ['storageKey'],
        });
        return;
      }
      if (value.url && !isAllowedMediaUrl(value.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL de media inválida',
          path: ['url'],
        });
      }
    })
    .transform((value) => {
      const storageKey = value.storageKey ?? storageKeyFromUrl(value.url);
      return {
        url: value.url ?? (storageKey ? `${STORAGE_URL_PREFIX}${storageKey}` : ''),
        storageKey,
        mimeType: value.mimeType,
        sizeBytes: value.sizeBytes,
        fileName: value.fileName,
        alt: value.alt,
      };
    });
}
