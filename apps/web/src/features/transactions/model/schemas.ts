import { z } from 'zod';

const appCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === 'UYU' || value === 'USD', {
    message: 'Usá UYU o USD',
  });

export const createTransactionSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  conditionsSummary: z
    .string()
    .trim()
    .min(10, 'Describí las condiciones (mín. 10 caracteres)')
    .max(5000),
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresá un monto válido' })
    .positive('El monto debe ser mayor a 0')
    .max(100_000_000, 'Monto demasiado alto'),
  currency: appCurrencySchema.default('UYU'),
  inviteExpiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export type CreateTransactionValues = z.infer<typeof createTransactionSchema>;

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
  imageUrl: z.string().trim().optional().or(z.literal('')),
});

export type ConfirmSaleValues = z.infer<typeof confirmSaleSchema>;

export const createSellerTransactionSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  conditionsSummary: z
    .string()
    .trim()
    .min(10, 'Describí las condiciones (mín. 10 caracteres)')
    .max(5000),
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
  imageUrl: z.string().trim().optional().or(z.literal('')),
});

export type CreateSellerTransactionValues = z.infer<
  typeof createSellerTransactionSchema
>;
