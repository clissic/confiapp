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

/** Params que MP agrega al volver de Checkout Pro (back_urls). */
export const syncCheckoutReturnBodySchema = z.object({
  mpPaymentId: z.string().trim().min(1).max(64).optional(),
  externalReference: z.string().trim().min(1).max(64).optional(),
  status: z.string().trim().min(1).max(32).optional(),
});

export type PaymentTransactionCodeParams = z.infer<
  typeof paymentTransactionCodeParamsSchema
>;
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
export type SyncCheckoutReturnBody = z.infer<typeof syncCheckoutReturnBodySchema>;
