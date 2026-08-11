import { z } from 'zod';
import {
  DistanceUnit,
  ProfileVisibility,
  ThemePreference,
  UserPhotoKind,
  UserStatus,
} from '@confiapp/database';

import { isStrongPassword } from '../../utils/crypto-tokens';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{7,32}$/, 'Invalid phone format');

export const addressBodySchema = z.object({
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, 'country must be ISO 3166-1 alpha-2'),
    ])
    .optional(),
  postalCode: z.string().trim().max(32).optional(),
  formatted: z.string().trim().max(500).optional(),
});

export const photoBodySchema = z.object({
  url: z
    .string()
    .trim()
    .max(4_000_000)
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith('data:image/'),
      'Se espera URL http(s) o data:image',
    ),
  storageKey: z.string().trim().max(512).optional(),
  kind: z.nativeEnum(UserPhotoKind).optional(),
  mimeType: z.string().trim().max(128).optional(),
  sizeBytes: z.number().int().min(0).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
});

export const payoutMethodBodySchema = z
  .object({
    id: z.string().trim().max(64).optional(),
    bank: z.string().trim().min(2).max(64),
    number: z
      .string()
      .trim()
      .regex(/^\d{3,32}$/, 'El número de cuenta debe tener entre 3 y 32 dígitos'),
    type: z.enum(['CA', 'CC', 'FINTECH']),
    currency: z.enum(['', 'UYU', 'USD']),
    createdAt: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'FINTECH' && value.currency !== '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las billeteras electrónicas no requieren moneda',
        path: ['currency'],
      });
    }
    if (value.type !== 'FINTECH' && value.currency !== 'UYU' && value.currency !== 'USD') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Seleccioná UYU o USD',
        path: ['currency'],
      });
    }
  });

export const preferencesBodySchema = z.object({
  language: z.string().trim().min(2).max(16).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'currency must be ISO 4217')
    .optional(),
  theme: z.nativeEnum(ThemePreference).optional(),
  distanceUnit: z.nativeEnum(DistanceUnit).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      sms: z.boolean().optional(),
      inApp: z.boolean().optional(),
      marketing: z.boolean().optional(),
      transactionUpdates: z.boolean().optional(),
      messageAlerts: z.boolean().optional(),
      paymentAlerts: z.boolean().optional(),
      disputeAlerts: z.boolean().optional(),
    })
    .optional(),
  privacy: z
    .object({
      showLocation: z.boolean().optional(),
      showPhone: z.boolean().optional(),
      showEmail: z.boolean().optional(),
      showRating: z.boolean().optional(),
      profileVisibility: z.nativeEnum(ProfileVisibility).optional(),
    })
    .optional(),
});

export const registerUserBodySchema = z.object({
  email: z.string().email().max(320),
  password: z
    .string()
    .min(8)
    .max(128)
    .refine(isStrongPassword, {
      message:
        'Password must include upper, lower, number and special character (8–128 chars)',
    }),
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre completo debe tener al menos 2 caracteres')
    .max(120, 'El nombre completo es demasiado largo'),
  documentNumber: z
    .string()
    .trim()
    .min(5, 'Documento demasiado corto')
    .max(32, 'Documento demasiado largo')
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9.\-\s/]*$/,
      'Usá solo letras, números y separadores (. - /)',
    ),
  phone: phoneSchema,
  avatar: z
    .string()
    .trim()
    .max(2_000_000)
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith('data:image/'),
      'Se espera URL http(s) o data:image',
    )
    .optional(),
});

export const updateUserBodySchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    displayName: z.string().trim().min(2).max(120).nullable().optional(),
    documentNumber: z
      .string()
      .trim()
      .min(5, 'Documento demasiado corto')
      .max(32, 'Documento demasiado largo')
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9.\-\s/]*$/,
        'Usá solo letras, números y separadores (. - /)',
      )
      .nullable()
      .optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    avatar: z
      .string()
      .trim()
      .max(2_000_000)
      .refine(
        (value) => /^https?:\/\//i.test(value) || value.startsWith('data:image/'),
        'Se espera URL http(s) o data:image',
      )
      .nullable()
      .optional(),
    status: z.nativeEnum(UserStatus).optional(),
    address: addressBodySchema.nullable().optional(),
    locationLabel: z.string().trim().max(200).nullable().optional(),
    photos: z.array(photoBodySchema).max(30).optional(),
    submitKyc: z.boolean().optional(),
    payoutMethods: z.array(payoutMethodBodySchema).max(20).optional(),
    preferences: preferencesBodySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const userIdParamsSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid user id'),
});

export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
