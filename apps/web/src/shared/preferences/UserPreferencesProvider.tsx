import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/ui/AuthProvider';
import { fetchMyProfile } from '@/features/profile/api/profile.api';
import { profileQueryKey } from '@/features/profile/hooks/useProfile';
import type {
  DistanceUnit,
  ThemePreference,
  UserProfile,
} from '@/features/profile/model/types';

import { fetchFxRates } from '@/shared/lib/fx';
import type { AppCurrency } from '@/shared/lib/money';
import { isAppCurrency } from '@/shared/lib/money';

import { setPreferencesSnapshot } from './snapshot';
import {
  applyResolvedTheme,
  resolveTheme,
  subscribeSystemTheme,
  type ResolvedTheme,
} from './theme';

const DEFAULT_PREFS: {
  language: string;
  timezone: string;
  currency: AppCurrency;
  theme: ThemePreference;
  distanceUnit: DistanceUnit;
} = {
  language: 'es',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Montevideo',
  currency: 'USD',
  theme: 'SYSTEM',
  distanceUnit: 'KM',
};

function normalizeCurrency(value: string | undefined): AppCurrency {
  const code = (value ?? 'USD').toUpperCase();
  return isAppCurrency(code) ? code : 'USD';
}

function prefsFromProfile(profile: UserProfile | undefined): {
  language: string;
  timezone: string;
  currency: AppCurrency;
  theme: ThemePreference;
  distanceUnit: DistanceUnit;
} {
  if (!profile) return { ...DEFAULT_PREFS, currency: 'USD' };
  return {
    language: profile.preferences.language || DEFAULT_PREFS.language,
    timezone: profile.preferences.timezone || DEFAULT_PREFS.timezone,
    currency: normalizeCurrency(profile.preferences.currency),
    theme: profile.preferences.theme || DEFAULT_PREFS.theme,
    distanceUnit: (profile.preferences.distanceUnit || 'KM') as DistanceUnit,
  };
}

interface UserPreferencesContextValue {
  language: string;
  timezone: string;
  currency: AppCurrency;
  theme: ThemePreference;
  distanceUnit: DistanceUnit;
  resolvedTheme: ResolvedTheme;
  isLoading: boolean;
  applyLocalPrefs: (
    partial: Partial<{
      language: string;
      timezone: string;
      currency: AppCurrency;
      theme: ThemePreference;
      distanceUnit: DistanceUnit;
    }>,
  ) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [localOverride, setLocalOverride] = useState<Partial<{
    language: string;
    timezone: string;
    currency: AppCurrency;
    theme: ThemePreference;
    distanceUnit: DistanceUnit;
  }> | null>(null);

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchMyProfile,
    enabled: isAuthenticated && !isBootstrapping,
    staleTime: 60_000,
  });

  const fromProfile = prefsFromProfile(profileQuery.data?.profile);
  const prefs = {
    language: localOverride?.language ?? fromProfile.language,
    timezone: localOverride?.timezone ?? fromProfile.timezone,
    currency: (localOverride?.currency ?? fromProfile.currency) as AppCurrency,
    theme: localOverride?.theme ?? fromProfile.theme,
    distanceUnit: localOverride?.distanceUnit ?? fromProfile.distanceUnit,
  };

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(prefs.theme),
  );

  useEffect(() => {
    setResolvedTheme(resolveTheme(prefs.theme));
    applyResolvedTheme(resolveTheme(prefs.theme));
    if (prefs.theme !== 'SYSTEM') return;
    return subscribeSystemTheme(() => {
      const next = resolveTheme('SYSTEM');
      setResolvedTheme(next);
      applyResolvedTheme(next);
    });
  }, [prefs.theme]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fx = await fetchFxRates();
      if (cancelled) return;
      setPreferencesSnapshot({
        language: prefs.language,
        timezone: prefs.timezone,
        currency: prefs.currency,
        theme: prefs.theme,
        distanceUnit: prefs.distanceUnit,
        rates: fx?.rates ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs.language, prefs.timezone, prefs.currency, prefs.theme, prefs.distanceUnit]);

  // Re-sync snapshot when profile loads without waiting FX
  useEffect(() => {
    setPreferencesSnapshot({
      language: prefs.language,
      timezone: prefs.timezone,
      currency: prefs.currency,
      theme: prefs.theme,
      distanceUnit: prefs.distanceUnit,
    });
  }, [prefs.language, prefs.timezone, prefs.currency, prefs.theme, prefs.distanceUnit]);

  useEffect(() => {
    if (!isAuthenticated) setLocalOverride(null);
  }, [isAuthenticated]);

  const applyLocalPrefs = useCallback(
    (
      partial: Partial<{
        language: string;
        timezone: string;
        currency: AppCurrency;
        theme: ThemePreference;
        distanceUnit: DistanceUnit;
      }>,
    ) => {
      setLocalOverride((current) => ({ ...current, ...partial }));
    },
    [],
  );

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      language: prefs.language,
      timezone: prefs.timezone,
      currency: prefs.currency,
      theme: prefs.theme,
      distanceUnit: prefs.distanceUnit,
      resolvedTheme,
      isLoading: profileQuery.isLoading && isAuthenticated,
      applyLocalPrefs,
    }),
    [
      prefs.language,
      prefs.timezone,
      prefs.currency,
      prefs.theme,
      prefs.distanceUnit,
      resolvedTheme,
      profileQuery.isLoading,
      isAuthenticated,
      applyLocalPrefs,
    ],
  );

  return (
    <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  }
  return ctx;
}
