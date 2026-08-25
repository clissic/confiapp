import { ValidationError } from '../errors/app-error';
import { env } from './env';

/** Monedas conocidas (USD deshabilitado operativamente en MVP). */
export const KNOWN_CURRENCIES = ['UYU', 'USD'] as const;
export type KnownCurrency = (typeof KNOWN_CURRENCIES)[number];

/** Monedas habilitadas para operaciones financieras del MVP. */
export const ENABLED_CURRENCIES = ['UYU'] as const;
export type AppCurrency = (typeof ENABLED_CURRENCIES)[number];

/** @deprecated Usar ENABLED_CURRENCIES / KNOWN_CURRENCIES. */
export const SUPPORTED_CURRENCIES = KNOWN_CURRENCIES;

export function isKnownCurrency(value: string): value is KnownCurrency {
  return (KNOWN_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

export function isEnabledCurrency(value: string): value is AppCurrency {
  return (ENABLED_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

/** @deprecated Usar isEnabledCurrency. */
export function isSupportedCurrency(value: string): value is AppCurrency {
  return isEnabledCurrency(value);
}

/** Moneda por defecto de la app (pesos uruguayos). */
export function defaultCurrency(): AppCurrency {
  const configured = env.PAYMENTS_DEFAULT_CURRENCY.toUpperCase();
  return isEnabledCurrency(configured) ? configured : 'UYU';
}

export function assertAppCurrency(value: string | undefined | null): AppCurrency {
  const code = (value ?? defaultCurrency()).toUpperCase();
  if (!isEnabledCurrency(code)) {
    throw new ValidationError(
      `Moneda no habilitada: ${code}. Por ahora solo UYU está habilitado.`,
    );
  }
  return code;
}

/** Monto ejemplo para demos / operaciones sin amount (siempre UYU). */
export function exampleGrossCents(_currency: AppCurrency = defaultCurrency()): number {
  return 5_000_000; // $50.000 UYU
}
