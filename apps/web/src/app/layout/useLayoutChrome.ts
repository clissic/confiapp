import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useUpdateProfile } from '@/features/profile/hooks/useProfile';
import { useUserPreferences } from '@/shared/preferences';
import type { ResolvedTheme } from '@/shared/preferences';

/** Tema del chrome: resuelve SYSTEM y sincroniza toggle con preferencias del perfil. */
export function useLayoutChrome() {
  const { isAuthenticated } = useAuth();
  const { resolvedTheme, theme, applyLocalPrefs } = useUserPreferences();
  const update = useUpdateProfile();

  const toggleTheme = () => {
    const next: 'LIGHT' | 'DARK' = resolvedTheme === 'light' ? 'DARK' : 'LIGHT';
    applyLocalPrefs({ theme: next });
    if (isAuthenticated) {
      void update.mutateAsync({ preferences: { theme: next } });
    }
  };

  return {
    theme: resolvedTheme as ResolvedTheme,
    preference: theme,
    toggleTheme,
  };
}
