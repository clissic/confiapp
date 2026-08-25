import { z } from 'zod';

import { isStrongPassword } from '../../utils/crypto-tokens';

const strongPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga')
  .refine(isStrongPassword, {
    message:
      'La contraseña debe incluir mayúscula, minúscula, número y un carácter especial (8–128)',
  });

export const registerBodySchema = z.object({
  email: z.string().email('Email inválido').max(320),
  password: strongPassword,
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
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,32}$/, 'Teléfono inválido'),
});

export const loginBodySchema = z.object({
  email: z.string().email('Email inválido').max(320),
  password: z.string().min(1, 'Ingresá tu contraseña').max(128),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(20).optional(),
  allDevices: z.boolean().optional().default(false),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Ingresá tu contraseña actual').max(128),
  newPassword: strongPassword,
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email('Email inválido').max(320),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(20, 'Enlace inválido'),
  newPassword: strongPassword,
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(20, 'Enlace inválido'),
});

export const resendVerificationBodySchema = z.object({
  email: z.string().email('Email inválido').max(320),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;
export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>;
