import { z } from 'zod';

import { isStrongPassword } from '../../utils/crypto-tokens';

const strongPassword = z
  .string()
  .min(8)
  .max(128)
  .refine(isStrongPassword, {
    message:
      'Password must include upper, lower, number and special character (8–128 chars)',
  });

export const registerBodySchema = z.object({
  email: z.string().email().max(320),
  password: strongPassword,
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,32}$/)
    .optional(),
});

export const loginBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(20).optional(),
  allDevices: z.boolean().optional().default(false),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPassword,
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email().max(320),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(20),
  newPassword: strongPassword,
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(20),
});

export const resendVerificationBodySchema = z.object({
  email: z.string().email().max(320),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;
export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>;
