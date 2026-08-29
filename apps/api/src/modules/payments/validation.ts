import { z } from 'zod';

export const paymentTransactionCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .transform((value) => value.toUpperCase()),
});

export const paymentIdParamsSchema = z.object({
  paymentId: z.string().min(1),
});

export const paymentLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const manualPrexTransferBodySchema = z.object({
  receiptDataUrl: z
    .string()
    .trim()
    .min(32)
    .max(5_500_000)
    .refine(
      (value) =>
        /^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(value),
      'El comprobante debe ser imagen JPEG/PNG/WebP o PDF (data URL)',
    ),
  receiptFileName: z.string().trim().min(1).max(180).optional(),
});

export const adminManualTransfersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
});

export const manualPrexAdminConfirmationBodySchema = z.object({
  confirmed: z.boolean(),
});

export type PaymentTransactionCodeParams = z.infer<
  typeof paymentTransactionCodeParamsSchema
>;
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
export type ManualPrexTransferBody = z.infer<typeof manualPrexTransferBodySchema>;
