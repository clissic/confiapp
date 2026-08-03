import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{7,32}$/, 'Usá un teléfono válido (7–32 dígitos, puede iniciar con +)');

export const editProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  displayName: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional(),
});

export const phoneFormSchema = z.object({
  phone: phoneSchema,
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
  url: z.string().url('URL de imagen inválida').max(2048),
  kind: z.enum(['AVATAR', 'PROFILE', 'ID_FRONT', 'ID_BACK', 'SELFIE', 'OTHER']),
  isPrimary: z.boolean(),
});

export const settingsFormSchema = z.object({
  language: z.string().min(2).max(16),
  locale: z.string().min(2).max(16),
  timezone: z.string().min(2).max(64),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Moneda ISO 4217 (UYU o USD)'),
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
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
