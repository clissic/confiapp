import { z } from 'zod';

import { PAYOUT_BANK_OPTIONS } from './payout-methods';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{7,32}$/, 'Usá un teléfono válido (7–32 dígitos, puede iniciar con +)');

export const phoneFormSchema = z.object({
  countryIso: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Seleccioná un código de país'),
  nationalNumber: z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, 'Ingresá solo el número (6 a 15 dígitos, sin código de país)'),
});

export const editProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  documentNumber: z
    .string()
    .trim()
    .max(32, 'Máximo 32 caracteres')
    .refine(
      (value) =>
        value === '' ||
        (/^[A-Za-z0-9][A-Za-z0-9.\-\s/]*$/.test(value) && value.length >= 5),
      {
        message: 'DNI / pasaporte inválido (mín. 5 caracteres)',
      },
    )
    .optional(),
  bio: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional(),
  street: z.string().trim().max(160).optional(),
  streetNumber: z.string().trim().max(32).optional(),
  floor: z.string().trim().max(80).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === '' || /^[A-Z]{2}$/.test(value), {
      message: 'País en código ISO de 2 letras (ej. UY)',
    }),
  state: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  neighborhood: z.string().trim().max(200).optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^(\d{0,12})$/, 'Solo números')
    .optional(),
  countryIso: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Seleccioná un código de país'),
  nationalNumber: z
    .string()
    .trim()
    .regex(/^(\d{6,15})?$/, 'Ingresá solo el número (6 a 15 dígitos)'),
});

export const addressFormSchema = z.object({
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'Ciudad requerida').max(120),
  state: z.string().trim().max(120).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Código de país ISO de 2 letras (ej. AR)'),
  postalCode: z.string().trim().max(32).optional(),
  locationLabel: z.string().trim().max(200).optional(),
});

export const photoFormSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Indicá una URL o subí un archivo')
    .max(2_000_000)
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith('data:image/'),
      'Usá una URL http(s) o un archivo de imagen',
    ),
});

export const payoutMethodFormSchema = z
  .object({
    bank: z
      .string()
      .trim()
      .min(1, 'Seleccioná un banco o billetera')
      .refine((value) => (PAYOUT_BANK_OPTIONS as readonly string[]).includes(value), {
        message: 'Banco o billetera no soportado',
      }),
    number: z
      .string()
      .trim()
      .regex(/^\d{3,32}$/, 'El número de cuenta debe tener entre 3 y 32 dígitos'),
    type: z.enum(['CA', 'CC', 'FINTECH']),
    currency: z.enum(['', 'UYU', 'USD']),
  })
  .superRefine((value, ctx) => {
    if (value.type !== 'FINTECH' && value.currency !== 'UYU' && value.currency !== 'USD') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Seleccioná la moneda de la cuenta',
        path: ['currency'],
      });
    }
  });

export const settingsFormSchema = z.object({
  language: z.enum(['es', 'en', 'pt']),
  locale: z.string().min(2).max(16),
  timezone: z.string().min(2).max(64),
  currency: z.enum(['UYU', 'USD', 'BRL']),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
  distanceUnit: z.enum(['KM', 'MI']),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
    inApp: z.boolean(),
    marketing: z.boolean(),
    transactionUpdates: z.boolean(),
    messageAlerts: z.boolean(),
    paymentAlerts: z.boolean(),
    disputeAlerts: z.boolean(),
  }),
  privacy: z.object({
    showLocation: z.boolean(),
    showPhone: z.boolean(),
    showEmail: z.boolean(),
    showRating: z.boolean(),
    profileVisibility: z.enum(['PUBLIC', 'PRIVATE', 'CONTACTS']),
  }),
});

export type EditProfileValues = z.infer<typeof editProfileSchema>;
export type PhoneFormValues = z.infer<typeof phoneFormSchema>;
export type AddressFormValues = z.infer<typeof addressFormSchema>;
export type PhotoFormValues = z.infer<typeof photoFormSchema>;
export type PayoutMethodFormValues = z.infer<typeof payoutMethodFormSchema>;
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
