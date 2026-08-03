import { apiClient } from '@/shared/api/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  status: string;
  role: string;
  emailVerified: boolean;
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
  phone?: string;
}): Promise<{ user: AuthUser; message: string }> {
  const { data } = await apiClient.post<{ user: AuthUser; message: string }>(
    '/auth/register',
    input,
  );
  return data;
}

export async function fetchAuthMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken') ?? undefined;
  try {
    await apiClient.post('/auth/logout', { refreshToken, allDevices: false });
  } catch {
    // Igual limpiamos sesión local.
  }
}
