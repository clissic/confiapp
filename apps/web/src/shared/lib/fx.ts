/** Cotizaciones y conversión de montos (centavos) entre monedas de display. */

export type FxRatesMap = Record<string, number>;

export interface FxRates {
  base: string;
  rates: FxRatesMap;
  fetchedAt: number;
}

const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MS = 60 * 60 * 1000;

let memoryCache: FxRates | null = null;
let inflight: Promise<FxRates | null> | null = null;

export function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string,
  rates: FxRatesMap | null | undefined,
): number {
  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();
  if (from === to || cents == null || Number.isNaN(cents)) return cents;
  if (!rates || rates[from] == null || rates[to] == null) return cents;

  // rates are relative to USD base: amount_in_usd = amount / rates[from]
  const inUsd = cents / rates[from]!;
  return Math.round(inUsd * rates[to]!);
}

export async function fetchFxRates(force = false): Promise<FxRates | null> {
  if (!force && memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_MS) {
    return memoryCache;
  }
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(FX_URL);
      if (!response.ok) throw new Error(`FX HTTP ${response.status}`);
      const data = (await response.json()) as {
        result?: string;
        base_code?: string;
        rates?: FxRatesMap;
      };
      if (data.result !== 'success' || !data.rates) throw new Error('FX payload inválido');

      const next: FxRates = {
        base: data.base_code ?? 'USD',
        rates: {
          ...data.rates,
          USD: data.rates.USD ?? 1,
        },
        fetchedAt: Date.now(),
      };
      memoryCache = next;
      return next;
    } catch {
      return memoryCache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function getCachedFxRates(): FxRates | null {
  return memoryCache;
}

/** Solo tests. */
export function __setFxRatesForTests(rates: FxRates | null) {
  memoryCache = rates;
}
