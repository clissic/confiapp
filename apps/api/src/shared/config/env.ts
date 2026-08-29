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
  /** Access Token de Mercado Pago Uruguay (cuenta MLU / plataforma). Vacío = MOCK. */
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional().default(''),
  /** Secret para validar firmas x-signature del webhook (opcional en dev). */
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional().default(''),
  /** OAuth app (vendedores): Application ID / Client ID. */
  MERCADOPAGO_CLIENT_ID: z.string().optional().default(''),
  /** OAuth app: Client Secret (solo servidor). */
  MERCADOPAGO_CLIENT_SECRET: z.string().optional().default(''),
  /**
   * Redirect URI estática registrada en el panel MP.
   * Debe coincidir exactamente (sin query extra).
   */
  MERCADOPAGO_OAUTH_REDIRECT_URI: z.string().optional().default(''),
  /**
   * Clave AES-256 para cifrar access/refresh tokens de sellers.
   * Preferible: 64 hex chars (32 bytes). Si no, se deriva con SHA-256.
   */
  MERCADOPAGO_TOKEN_ENCRYPTION_KEY: z.string().optional().default(''),
  /** País del seller MP: UY = Uruguay. */
  MERCADOPAGO_COUNTRY: z.enum(['UY', 'AR', 'BR', 'MX', 'CL', 'CO', 'PE']).default('UY'),
  /** Site ID Checkout: MLU = Mercado Libre Uruguay. */
  MERCADOPAGO_SITE_ID: z.string().default('MLU'),
  /** Habilitar refunds live vía API MP (MOCK siempre simula). */
  MERCADOPAGO_ENABLE_REFUNDS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * Modo de cobro al comprador.
   * - `manual_prex`: MVP — transferencia a Prex + comprobante (MP en standby).
   * - `mercadopago`: Checkout Pro / MOCK según MERCADOPAGO_ACCESS_TOKEN.
   */
  PAYMENTS_CHECKOUT_MODE: z.enum(['manual_prex', 'mercadopago']).default('manual_prex'),
  /** Titular de la cuenta Prex de la plataforma (MVP). */
  PAYMENTS_PREX_ACCOUNT_NAME: z.string().default('Ignacio La Cava'),
  /** Número de cuenta Prex de la plataforma (MVP). */
  PAYMENTS_PREX_ACCOUNT_NUMBER: z.string().default('1065233'),
  /** Moneda por defecto de la app. */
  PAYMENTS_DEFAULT_CURRENCY: z.enum(['UYU', 'USD']).default('UYU'),
  /**
   * UYU por 1 USD — clasificar escalones de comisión de agente cuando el monto
   * de la operación no está en USD.
   */
  USD_UYU_RATE: z.coerce.number().positive().default(40),
  /** % de la comisión de intermediación para la plataforma (2000 = 20%). */
  PAYMENTS_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(2000),
  /** % de la comisión de intermediación para el agente (8000 = 80%). */
  PAYMENTS_AGENT_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(8000),
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
  /**
   * Admin bootstrap (opcional). Si email+password están definidos, al arrancar
   * se asegura un usuario ADMIN activo con email verificado.
   */
  ADMIN_EMAIL: z.string().optional().default(''),
  ADMIN_PASSWORD: z.string().optional().default(''),
  ADMIN_FULL_NAME: z.string().optional().default('ConfiApp Admin'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
