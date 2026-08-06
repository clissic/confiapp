import { z } from 'zod';

import {
  ProductCategory,
  ProductCondition,
} from '@confiapp/database';

const appCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === 'UYU' || value === 'USD', {
    message: 'Moneda inválida. Usá UYU o USD',
  });

const imageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(8)
    .max(2048)
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith('data:image/'),
      'URL de imagen inválida',
    ),
  alt: z.string().trim().max(200).optional(),
});

const productPayloadSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10_000),
  condition: z.nativeEnum(ProductCondition),
  category: z.nativeEnum(ProductCategory).default(ProductCategory.OTHER),
  price: z.coerce.number().positive('El precio debe ser mayor a 0').max(100_000_000),
  currency: appCurrencySchema.default('UYU'),
  images: z.array(imageSchema).min(1, 'Agregá al menos una foto').max(20),
});

export const createTransactionBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  conditionsSummary: z.string().trim().min(10).max(5000),
  checklist: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0').max(100_000_000),
  currency: appCurrencySchema.default('UYU'),
  inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const createSellerTransactionBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  conditionsSummary: z.string().trim().min(10).max(5000),
  checklist: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  product: productPayloadSchema,
});

export const confirmSaleBodySchema = productPayloadSchema;

export const transactionCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CONF-[A-Z0-9]{6,16}$/, 'Invalid transaction code'),
});

export const transactionChecklistParamsSchema = transactionCodeParamsSchema.extend({
  itemId: z.string().trim().min(1).max(64),
});

export const toggleChecklistBodySchema = z.object({
  done: z.boolean(),
});

export const inviteTokenParamsSchema = z.object({
  token: z.string().trim().min(20).max(200),
});

export const transactionIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;
export type CreateSellerTransactionBody = z.infer<typeof createSellerTransactionBodySchema>;
export type ConfirmSaleBody = z.infer<typeof confirmSaleBodySchema>;
export type TransactionCodeParams = z.infer<typeof transactionCodeParamsSchema>;
export type InviteTokenParams = z.infer<typeof inviteTokenParamsSchema>;
export type ToggleChecklistBody = z.infer<typeof toggleChecklistBodySchema>;
