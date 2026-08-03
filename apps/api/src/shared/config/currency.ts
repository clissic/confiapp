import { ValidationError } from '../errors/app-error';
import { env } from './env';

/** Monedas soportadas en ConfiApp Uruguay. */
export const SUPPORTED_CURRENCIES = ['UYU', 'USD'] as const;
export type AppCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is AppCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

/** Moneda por defecto de la app (pesos uruguayos). */
export function defaultCurrency(): AppCurrency {
  const configured = env.PAYMENTS_DEFAULT_CURRENCY.toUpperCase();
  return isSupportedCurrency(configured) ? configured : 'UYU';
}

export function assertAppCurrency(value: string | undefined | null): AppCurrency {
  const code = (value ?? defaultCurrency()).toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new ValidationError(`Moneda no soportada: ${code}. Usá UYU o USD.`);
  }
  return code;
}

/** Monto ejemplo para demos / operaciones sin amount. */
export function exampleGrossCents(currency: AppCurrency = defaultCurrency()): number {
  // ~$50.000 UYU o ~$1.000 USD
  return currency === 'USD' ? 100_000 : 5_000_000;
}
