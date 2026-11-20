import { z } from 'zod';

export const mediaPurposeSchema = z.enum([
  'chat',
  'kyc',
  'product',
  'receipt',
  'profile',
  'evidence',
]);

export const presignBodySchema = z
  .object({
    purpose: mediaPurposeSchema,
    contentType: z.string().trim().min(3).max(128),
    contentLength: z.number().int().positive().max(6 * 1024 * 1024),
    fileName: z.string().trim().max(255).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.purpose === 'evidence' && !/^image\/(jpeg|jpg|png|webp)$/i.test(value.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Para evidencia de disputa solo se admiten fotos (JPEG/PNG/WebP). Sin video ni audio.',
        path: ['contentType'],
      });
    }
  });

export const confirmBodySchema = z.object({
  storageKey: z.string().trim().min(3).max(512),
  purpose: mediaPurposeSchema,
});

export const signedUrlBodySchema = z.object({
  storageKey: z.string().trim().min(3).max(512),
});

export type PresignBody = z.infer<typeof presignBodySchema>;
export type ConfirmBody = z.infer<typeof confirmBodySchema>;
export type SignedUrlBody = z.infer<typeof signedUrlBodySchema>;
