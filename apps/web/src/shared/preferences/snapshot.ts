import type { DistanceUnit, ThemePreference } from '@/features/profile/model/types';

import type { FxRatesMap } from '@/shared/lib/fx';

export type DisplayCurrency = 'UYU' | 'USD' | 'BRL';

export interface PreferencesSnapshot {
  language: string;
  timezone: string;
  currency: DisplayCurrency;
  theme: ThemePreference;
  distanceUnit: DistanceUnit;
  rates: FxRatesMap | null;
}

const DEFAULT_SNAPSHOT: PreferencesSnapshot = {
  language: 'es',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Montevideo',
  currency: 'UYU',
  theme: 'SYSTEM',
  distanceUnit: 'KM',
  rates: null,
};

let snapshot: PreferencesSnapshot = { ...DEFAULT_SNAPSHOT };
const listeners = new Set<() => void>();

export function getPreferencesSnapshot(): PreferencesSnapshot {
  return snapshot;
}

export function setPreferencesSnapshot(partial: Partial<PreferencesSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  listeners.forEach((listener) => listener());
}

export function subscribePreferencesSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetPreferencesSnapshot() {
  snapshot = { ...DEFAULT_SNAPSHOT };
  listeners.forEach((listener) => listener());
}
