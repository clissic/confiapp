import { z } from 'zod';

import { env } from '../config/env';

/** true cuando hay que rechazar data URLs grandes y exigir storageKey. */
export function mustUseObjectStorage(): boolean {
  return env.STORAGE_REQUIRE_OBJECT_KEYS;
}

/**
 * Adjunto: storageKey (preferido) o url http(s)/data: legacy.
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
      const hasKey = Boolean(value.storageKey);
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
      if (value.url) {
        const ok =
          /^https?:\/\//i.test(value.url) ||
          value.url.startsWith('data:image/') ||
          value.url.startsWith('data:application/pdf');
        if (!ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'URL de media inválida',
            path: ['url'],
          });
        }
      }
    })
    .transform((value) => ({
      url: value.url ?? (value.storageKey ? `storage://${value.storageKey}` : ''),
      storageKey: value.storageKey,
      mimeType: value.mimeType,
      sizeBytes: value.sizeBytes,
      fileName: value.fileName,
      alt: value.alt,
    }));
}
