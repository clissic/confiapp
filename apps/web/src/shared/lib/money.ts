import { convertCents, type FxRatesMap } from './fx';
import { getPreferencesSnapshot, type DisplayCurrency } from '../preferences/snapshot';

/** Monedas de display soportadas en ConfiApp. */
export const APP_CURRENCIES = ['UYU', 'USD', 'BRL'] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];

export const PAYMENT_CURRENCIES = ['UYU', 'USD'] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const DEFAULT_CURRENCY: AppCurrency = 'USD';
export const APP_LOCALE = 'es-UY';

export const CURRENCY_OPTIONS: Array<{ code: AppCurrency; label: string }> = [
  { code: 'UYU', label: 'UYU $' },
  { code: 'USD', label: 'USD $' },
  { code: 'BRL', label: 'BRL $' },
];

export function isAppCurrency(value: string): value is AppCurrency {
  return (APP_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return (PAYMENT_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

/** Moneda por defecto al crear cobros (BRL de display → USD). */
export function defaultPaymentCurrency(preferred?: string): PaymentCurrency {
  const code = (preferred ?? DEFAULT_CURRENCY).toUpperCase();
  return isPaymentCurrency(code) ? code : 'USD';
}

/** Monto numérico en locale es-UY: miles con punto, decimales con coma. */
function formatAmountNumber(cents: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Estándar ConfiApp ISO 4217: `USD $1.500,00` / `UYU $40,00` / `BRL $25,50`.
 * Código ISO + espacio + `$` pegado al monto.
 */
function formatInCurrency(cents: number, currency: string): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  return `${code} $${formatAmountNumber(cents)}`;
}

/**
 * Formatea un monto. Si hay preferencia + rates, convierte a la moneda de display.
 * Pasá `options.convert: false` para forzar la moneda fuente (p. ej. formularios de cobro).
 */
export function formatMoney(
  cents?: number,
  sourceCurrency: string = DEFAULT_CURRENCY,
  options?: {
    convert?: boolean;
    displayCurrency?: DisplayCurrency | string;
    rates?: FxRatesMap | null;
  },
): string {
  if (cents == null || Number.isNaN(cents)) return '—';

  const prefs = getPreferencesSnapshot();
  const shouldConvert = options?.convert !== false;
  const source = (sourceCurrency || DEFAULT_CURRENCY).toUpperCase();
  const target = (
    options?.displayCurrency ?? (shouldConvert ? prefs.currency : source)
  ).toUpperCase();
  const rates = options?.rates !== undefined ? options.rates : prefs.rates;

  if (!shouldConvert) {
    return formatInCurrency(cents, source);
  }

  if (source === target) {
    return formatInCurrency(cents, target);
  }

  const canConvert =
    Boolean(rates) && rates![source] != null && rates![target] != null;

  if (!canConvert) {
    // Sin cotización: mostrar en moneda fuente para no mentir el monto.
    return formatInCurrency(cents, source);
  }

  return formatInCurrency(convertCents(cents, source, target, rates), target);
}

export function formatDateTime(
  iso: string,
  options?: {
    timeZone?: string;
    dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
    timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  },
): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const prefs = getPreferencesSnapshot();
    return date.toLocaleString(APP_LOCALE, {
      timeZone: options?.timeZone ?? prefs.timezone,
      dateStyle: options?.dateStyle ?? 'short',
      timeStyle: options?.timeStyle ?? 'short',
    });
  } catch {
    return iso;
  }
}

export function formatTime(
  iso: string,
  options?: { timeZone?: string },
): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const prefs = getPreferencesSnapshot();
    return new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: options?.timeZone ?? prefs.timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return iso;
  }
}
