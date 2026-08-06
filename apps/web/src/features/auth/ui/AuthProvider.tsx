import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearSession,
  fetchAuthMe,
  getAccessToken,
  getStoredUser,
  logoutRequest,
  persistSession,
  persistUser,
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

/** Estado de sesión (JWT + usuario) para toda la app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isBootstrapping, setIsBootstrapping] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) {
          persistUser(me);
          setUser(me);
        }
      } catch {
        if (!cancelled) {
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
      isAuthenticated: Boolean(user && getAccessToken()),
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
