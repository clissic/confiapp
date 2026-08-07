import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiClientError } from '@/shared/api/client';

import {
  clearSession,
  fetchAuthMe,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  logoutRequest,
  persistSession,
  persistUser,
  refreshSessionRequest,
  type AuthSession,
  type AuthUser,
} from '../api/auth.api';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  setSession: (session: AuthSession) => void;
  patchUser: (partial: Partial<AuthUser>) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.statusCode === 401;
}

/** Estado de sesión (JWT + usuario) para toda la app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isBootstrapping, setIsBootstrapping] = useState(
    () => Boolean(getAccessToken() || getRefreshToken()),
  );

  useEffect(() => {
    const onCleared = () => {
      setUser(null);
    };
    window.addEventListener('auth:session-cleared', onCleared);
    return () => window.removeEventListener('auth:session-cleared', onCleared);
  }, []);

  useEffect(() => {
    const access = getAccessToken();
    const refresh = getRefreshToken();
    if (!access && !refresh) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const applyUser = (next: AuthUser) => {
        if (cancelled) return;
        persistUser(next);
        setUser(next);
      };

      try {
        applyUser(await fetchAuthMe());
      } catch (meError) {
        // El interceptor ya pudo renovar; si sigue fallando, intentamos refresh explícito.
        if (!getRefreshToken()) {
          if (isUnauthorized(meError) && !cancelled) {
            clearSession();
            setUser(null);
          }
          return;
        }

        try {
          const session = await refreshSessionRequest();
          if (cancelled) return;
          persistSession(session);
          setUser(session.user);
          try {
            applyUser(await fetchAuthMe());
          } catch {
            // Quedamos con el user del refresh.
          }
        } catch (refreshError) {
          if (cancelled) return;
          // API caída / reinicio: no borrar tokens; el user en localStorage alcanza.
          if (!isUnauthorized(refreshError) && getStoredUser()) {
            setUser(getStoredUser());
            return;
          }
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((session: AuthSession) => {
    persistSession(session);
    setUser(session.user);
  }, []);

  const patchUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...partial };
      persistUser(next);
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await fetchAuthMe();
    persistUser(me);
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user && (getAccessToken() || getRefreshToken())),
      isBootstrapping,
      setSession,
      patchUser,
      refreshUser,
      logout,
    }),
    [user, isBootstrapping, setSession, patchUser, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
