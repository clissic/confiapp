import { useSyncExternalStore } from 'react';

import {
  getPreferencesSnapshot,
  subscribePreferencesSnapshot,
  type PreferencesSnapshot,
} from './snapshot';

/** Suscribe el componente a moneda/FX/zona para recalcular formatMoney y fechas. */
export function usePreferencesSnapshot(): PreferencesSnapshot {
  return useSyncExternalStore(
    subscribePreferencesSnapshot,
    getPreferencesSnapshot,
    getPreferencesSnapshot,
  );
}
