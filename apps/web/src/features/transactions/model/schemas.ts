import { z } from 'zod';

const appCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === 'UYU' || value === 'USD', {
    message: 'Usá UYU o USD',
  });

const feePayerSchema = z.enum(['BUYER', 'SELLER', 'SPLIT_50_50'], {
  required_error: 'Elegí quién paga la comisión',
});

const productConditions = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'] as const;
const productCategories = [
  'ELECTRONICS',
  'VEHICLES',
  'REAL_ESTATE',
  'FASHION',
  'HOME',
  'SERVICES',
  'OTHER',
] as const;

const agentConditionsSchema = {
  conditionsSummary: z
    .string()
    .trim()
    .min(10, 'Describí las condiciones para el Agente (mín. 10 caracteres)')
    .max(5000),
};

export const createTransactionSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  ...agentConditionsSchema,
  inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  productTitle: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  productDescription: z
    .string()
    .trim()
    .min(10, 'Describí el producto (mín. 10 caracteres)')
    .max(10_000),
  condition: z.enum(productConditions, {
    required_error: 'Elegí la condición',
  }),
  category: z.enum(productCategories).default('OTHER'),
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresá un monto válido' })
    .positive('El monto debe ser mayor a 0')
    .max(100_000_000, 'Monto demasiado alto'),
  currency: appCurrencySchema.default('UYU'),
  feePayer: feePayerSchema,
});

export type CreateTransactionValues = z.infer<typeof createTransactionSchema>;

export const confirmSaleSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z
    .string()
    .trim()
    .min(10, 'Describí el producto (mín. 10 caracteres)')
    .max(10_000),
  condition: z.enum(productConditions, {
    required_error: 'Elegí la condición',
  }),
  category: z.enum(productCategories).default('OTHER'),
  price: z.coerce
    .number({ invalid_type_error: 'Ingresá un precio válido' })
    .positive('El precio debe ser mayor a 0')
    .max(100_000_000),
  currency: appCurrencySchema.default('UYU'),
  feePayer: feePayerSchema,
  imageUrl: z.string().trim().optional().or(z.literal('')),
  ...agentConditionsSchema,
  returnInstructions: z
    .string()
    .trim()
    .min(10, 'Indicá al Agente cómo devolver tu producto si el comprador lo rechaza')
    .max(5000),
});

export type ConfirmSaleValues = z.infer<typeof confirmSaleSchema>;

export const createSellerTransactionSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  ...agentConditionsSchema,
  inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  productTitle: z.string().trim().min(3).max(200),
  productDescription: z.string().trim().min(10).max(10_000),
  condition: z.enum(productConditions, {
    required_error: 'Elegí la condición',
  }),
  category: z.enum(productCategories).default('OTHER'),
  price: z.coerce
    .number({ invalid_type_error: 'Ingresá un precio válido' })
    .positive('El precio debe ser mayor a 0')
    .max(100_000_000),
  currency: appCurrencySchema.default('UYU'),
  feePayer: feePayerSchema,
  imageUrl: z.string().trim().optional().or(z.literal('')),
  returnInstructions: z
    .string()
    .trim()
    .min(10, 'Indicá al Agente cómo devolver tu producto si el comprador lo rechaza')
    .max(5000),
});

export type CreateSellerTransactionValues = z.infer<
  typeof createSellerTransactionSchema
>;

export const acceptPurchaseSchema = z.object({
  ...agentConditionsSchema,
  feePayer: feePayerSchema,
  productTitle: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  productDescription: z
    .string()
    .trim()
    .min(10, 'Describí qué esperás recibir (mín. 10 caracteres)')
    .max(10_000),
});

export type AcceptPurchaseValues = z.infer<typeof acceptPurchaseSchema>;
