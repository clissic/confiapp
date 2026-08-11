import { z } from 'zod';

import {
  FeePayer,
  ProductCategory,
  ProductCondition,
} from '@confiapp/database';

const feePayerSchema = z.nativeEnum(FeePayer);
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
    .max(3_500_000)
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

const meetingLocationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
  label: z.string().trim().min(2).max(200),
});

const meetingLocationFieldsSchema = z.object({
  meetingLocationMode: z.enum(['MAP', 'CHAT', 'HOME']).default('CHAT'),
  meetingLocation: meetingLocationSchema.optional(),
});

function refineMeetingLocation(
  data: {
    meetingLocationMode: 'MAP' | 'CHAT' | 'HOME';
    meetingLocation?: z.infer<typeof meetingLocationSchema>;
  },
  ctx: z.RefinementCtx,
) {
  if (data.meetingLocationMode === 'CHAT') return;
  if (!data.meetingLocation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['meetingLocation'],
      message: 'Indicá el punto de entrega',
    });
  }
}

const agentInstructionsFieldsSchema = z.object({
  conditionsSummary: z.string().trim().min(10).max(5000),
  checklist: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  productTitle: z.string().trim().min(3).max(200).optional(),
  productDescription: z.string().trim().min(10).max(10_000).optional(),
});

export const createTransactionBodySchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    amount: z.coerce.number().positive('El monto debe ser mayor a 0').max(100_000_000),
    currency: appCurrencySchema.default('UYU'),
    feePayer: feePayerSchema,
    inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
    productTitle: z.string().trim().min(3).max(200),
    productDescription: z.string().trim().min(10).max(10_000),
  })
  .merge(agentInstructionsFieldsSchema)
  .merge(meetingLocationFieldsSchema)
  .superRefine(refineMeetingLocation);

export const createSellerTransactionBodySchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    feePayer: feePayerSchema,
    inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
    returnInstructions: z
      .string()
      .trim()
      .min(10, 'Indicá al Agente cómo devolver tu producto si el comprador lo rechaza')
      .max(5000),
    product: productPayloadSchema,
  })
  .merge(agentInstructionsFieldsSchema.omit({ productTitle: true, productDescription: true }))
  .merge(meetingLocationFieldsSchema)
  .superRefine(refineMeetingLocation);

export const confirmSaleBodySchema = productPayloadSchema
  .extend({
    feePayer: feePayerSchema,
    returnInstructions: z
      .string()
      .trim()
      .min(10, 'Indicá al Agente cómo devolver tu producto si el comprador lo rechaza')
      .max(5000),
  })
  .merge(agentInstructionsFieldsSchema.omit({ productTitle: true, productDescription: true }))
  .merge(meetingLocationFieldsSchema)
  .superRefine(refineMeetingLocation);

export const acceptPurchaseBodySchema = agentInstructionsFieldsSchema
  .extend({
    feePayer: feePayerSchema.optional(),
    productTitle: z.string().trim().min(3).max(200).optional(),
    productDescription: z.string().trim().min(10).max(10_000).optional(),
  })
  .merge(meetingLocationFieldsSchema)
  .superRefine(refineMeetingLocation);

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
  /** Lado del checklist (requerido si hay party). */
  side: z.enum(['buyer', 'seller']).optional(),
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
export type AcceptPurchaseBody = z.infer<typeof acceptPurchaseBodySchema>;
export type TransactionCodeParams = z.infer<typeof transactionCodeParamsSchema>;
export type InviteTokenParams = z.infer<typeof inviteTokenParamsSchema>;
export type ToggleChecklistBody = z.infer<typeof toggleChecklistBodySchema>;
