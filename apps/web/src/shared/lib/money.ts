/** Monedas soportadas en ConfiApp Uruguay. */
export const APP_CURRENCIES = ['UYU', 'USD'] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];

export const DEFAULT_CURRENCY: AppCurrency = 'UYU';
export const APP_LOCALE = 'es-UY';

export function formatMoney(
  cents?: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (cents == null || Number.isNaN(cents)) return '—';
  try {
    return new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      maximumFractionDigits: currency === 'UYU' ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(APP_LOCALE);
  } catch {
    return iso;
  }
}
