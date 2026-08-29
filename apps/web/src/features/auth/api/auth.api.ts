import { apiClient, refreshAccessToken } from '@/shared/api/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  status: string;
  role: string;
  emailVerified: boolean;
  identityVerified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

const USER_KEY = 'authUser';

export function persistSession(session: AuthSession): void {
  localStorage.setItem('accessToken', session.tokens.accessToken);
  localStorage.setItem('refreshToken', session.tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function persistUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem(USER_KEY);
  // Evitar que el stub de verificación telefónica se filtre entre cuentas.
  try {
    sessionStorage.removeItem('confiapp.phone.localVerified');
  } catch {
    /* ignore */
  }
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export async function loginRequest(email: string, password: string): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/auth/login', { email, password });
  return data;
}

export async function registerRequest(input: {
  email: string;
  password: string;
  fullName: string;
  documentNumber: string;
  phone: string;
}): Promise<{ user: AuthUser; message: string; needsVerification: boolean }> {
  const { data } = await apiClient.post<{
    user: AuthUser;
    message: string;
    needsVerification?: boolean;
  }>('/auth/register', input, { timeout: 45_000 });
  return {
    ...data,
    needsVerification: data.needsVerification ?? true,
  };
}

export async function verifyEmailRequest(token: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
  return data;
}

export async function resendVerificationRequest(email: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    '/auth/resend-verification',
    { email },
    { timeout: 45_000 },
  );
  return data;
}

export async function fetchAuthMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

/** Renueva tokens con el refresh guardado; actualiza localStorage. */
export async function refreshSessionRequest(): Promise<AuthSession> {
  await refreshAccessToken();
  const user = getStoredUser();
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!user || !accessToken || !refreshToken) {
    throw new Error('Sesión incompleta tras refresh');
  }
  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: '',
    },
  };
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken') ?? undefined;
  try {
    await apiClient.post('/auth/logout', { refreshToken, allDevices: false });
  } catch {
    // Igual limpiamos sesión local.
  }
}
