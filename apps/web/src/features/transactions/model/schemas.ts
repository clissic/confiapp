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

const fundingModeSchema = z.enum(['ESCROW_FULL', 'AGENT_FEE_ONLY']).default('AGENT_FEE_ONLY');

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

function refineEscrowPricing(
  data: {
    fundingMode?: string;
    amount?: number;
    price?: number;
    feePayer?: string;
  },
  ctx: z.RefinementCtx,
  opts: { amount?: boolean; price?: boolean; feePayer?: boolean },
) {
  if (data.fundingMode !== 'ESCROW_FULL') return;
  if (opts.amount && (data.amount == null || !(data.amount > 0))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: 'El monto debe ser mayor a 0',
    });
  }
  if (opts.price && (data.price == null || !(data.price > 0))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'El precio debe ser mayor a 0',
    });
  }
  if (opts.feePayer && !data.feePayer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['feePayer'],
      message: 'Elegí quién paga la comisión',
    });
  }
}

export const createTransactionSchema = z
  .object({
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
    fundingMode: fundingModeSchema,
    amount: z.coerce
      .number({ invalid_type_error: 'Ingresá un monto válido' })
      .positive('El monto debe ser mayor a 0')
      .max(100_000_000, 'Monto demasiado alto')
      .optional(),
    currency: appCurrencySchema.default('UYU'),
    feePayer: feePayerSchema.optional(),
    /** Tip opcional ConfiAnza; lo paga siempre quien crea la operación. */
    confiAnzaAmount: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? undefined : value),
      z.coerce
        .number({ invalid_type_error: 'Ingresá un monto válido' })
        .min(0, 'El monto no puede ser negativo')
        .max(100_000_000, 'Monto demasiado alto')
        .optional(),
    ),
    confiAnzaCurrency: appCurrencySchema.default('UYU'),
  })
  .superRefine((data, ctx) =>
    refineEscrowPricing(data, ctx, { amount: true, feePayer: true }),
  );

export type CreateTransactionValues = z.infer<typeof createTransactionSchema>;

export const confirmSaleSchema = z
  .object({
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
    fundingMode: fundingModeSchema.optional(),
    price: z.coerce
      .number({ invalid_type_error: 'Ingresá un precio válido' })
      .positive('El precio debe ser mayor a 0')
      .max(100_000_000)
      .optional(),
    currency: appCurrencySchema.default('UYU'),
    feePayer: feePayerSchema.optional(),
    imageUrl: z.string().trim().optional().or(z.literal('')),
    ...agentConditionsSchema,
    returnInstructions: z
      .string()
      .trim()
      .min(10, 'Indicá al Agente cómo devolver tu producto si el comprador lo rechaza')
      .max(5000),
  })
  .superRefine((data, ctx) =>
    refineEscrowPricing(data, ctx, { price: true, feePayer: true }),
  );

export type ConfirmSaleValues = z.infer<typeof confirmSaleSchema>;

export const createSellerTransactionSchema = z
  .object({
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
    fundingMode: fundingModeSchema,
    price: z.coerce
      .number({ invalid_type_error: 'Ingresá un precio válido' })
      .positive('El precio debe ser mayor a 0')
      .max(100_000_000)
      .optional(),
    currency: appCurrencySchema.default('UYU'),
    feePayer: feePayerSchema.optional(),
    imageUrl: z.string().trim().optional().or(z.literal('')),
    returnInstructions: z
      .string()
      .trim()
      .min(10, 'Indicá al Agente cómo devolver tu producto si el comprador lo rechaza')
      .max(5000),
    /** Tip opcional ConfiAnza; lo paga siempre quien crea la operación. */
    confiAnzaAmount: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? undefined : value),
      z.coerce
        .number({ invalid_type_error: 'Ingresá un monto válido' })
        .min(0, 'El monto no puede ser negativo')
        .max(100_000_000, 'Monto demasiado alto')
        .optional(),
    ),
    confiAnzaCurrency: appCurrencySchema.default('UYU'),
  })
  .superRefine((data, ctx) =>
    refineEscrowPricing(data, ctx, { price: true, feePayer: true }),
  );

export type CreateSellerTransactionValues = z.infer<
  typeof createSellerTransactionSchema
>;

export const acceptPurchaseSchema = z
  .object({
    ...agentConditionsSchema,
    fundingMode: fundingModeSchema.optional(),
    feePayer: feePayerSchema.optional(),
    productTitle: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
    productDescription: z
      .string()
      .trim()
      .min(10, 'Describí qué esperás recibir (mín. 10 caracteres)')
      .max(10_000),
  })
  .superRefine((data, ctx) => {
    if (data.fundingMode === 'ESCROW_FULL' && !data.feePayer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feePayer'],
        message: 'Elegí quién paga la comisión',
      });
    }
  });

export type AcceptPurchaseValues = z.infer<typeof acceptPurchaseSchema>;
