import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
      'DATABASE_URL must be a MongoDB URI',
    ),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  /** Compat: si existe JWT_EXPIRES_IN antiguo, se ignora a favor de ACCESS. */
  JWT_EXPIRES_IN: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  APP_URL: z.string().default('http://localhost:3001'),
  API_PUBLIC_URL: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Access Token de Mercado Pago Uruguay (cuenta MLU). Vacío = MOCK. */
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional().default(''),
  /** Secret para validar firmas x-signature del webhook (opcional en dev). */
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional().default(''),
  /** País del seller MP: UY = Uruguay. */
  MERCADOPAGO_COUNTRY: z.enum(['UY', 'AR', 'BR', 'MX', 'CL', 'CO', 'PE']).default('UY'),
  /** Site ID Checkout: MLU = Mercado Libre Uruguay. */
  MERCADOPAGO_SITE_ID: z.string().default('MLU'),
  /** Moneda por defecto de la app. */
  PAYMENTS_DEFAULT_CURRENCY: z.enum(['UYU', 'USD']).default('UYU'),
  /** Comisión plataforma en basis points (2000 = 20%). */
  PAYMENTS_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(2000),
  /** Pago al agente en basis points sobre el bruto (500 = 5% ejemplo). */
  PAYMENTS_AGENT_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  /** SMTP — si SMTP_HOST está vacío, se usa el mailer de consola (dev). */
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('ConfiApp <noreply@confiapp.local>'),
  /** Destinatario de notificaciones internas (KYC). Vacío = email parseado de MAIL_FROM. */
  PLATFORM_NOTIFY_EMAIL: z.string().default(''),
  /**
   * Secret para jobs internos (p. ej. expirar deadlines).
   * Header `x-job-secret`. Vacío = deshabilitado en production; en dev permite sin secret.
   */
  TRANSACTIONS_JOB_SECRET: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
