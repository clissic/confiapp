import { z } from 'zod';

import { attachmentRefSchema } from '../../shared/validation/media-ref';

export const chatIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const sendMessageBodySchema = z
  .object({
    body: z.string().trim().max(10_000).optional(),
    attachments: z.array(attachmentRefSchema({ maxDataUrlChars: 2_000_000 })).max(10).optional(),
  })
  .refine(
    (data) => Boolean(data.body?.trim()) || (data.attachments?.length ?? 0) > 0,
    { message: 'El mensaje no puede estar vacío' },
  );

export const markReadBodySchema = z.object({
  messageIds: z.array(z.string().min(1)).max(200).optional(),
});

export type ChatIdParams = z.infer<typeof chatIdParamsSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type MarkReadBody = z.infer<typeof markReadBodySchema>;
