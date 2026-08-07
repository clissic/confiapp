import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/shared/config/env';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/** Cliente sin interceptors — solo para renovar tokens (evita loops). */
const refreshClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type AuthRefreshResponse = {
  user: unknown;
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: string;
  };
};

let refreshInFlight: Promise<string> | null = null;

function isAuthRefreshUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/register')
  );
}

/** Renueva access/refresh. Comparte una sola promesa si hay varias llamadas en paralelo. */
export async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const { data } = await refreshClient.post<AuthRefreshResponse>('/auth/refresh', {
      refreshToken,
    });

    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
    if (data.user) {
      localStorage.setItem('authUser', JSON.stringify(data.user));
    }

    return data.tokens.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function notifySessionCleared(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('authUser');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:session-cleared'));
  }
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type ApiErrorBody = {
  message?: string;
  code?: string;
  statusCode?: number;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
    email?: string;
    [key: string]: unknown;
  };
};

export class ApiClientError extends Error {
  readonly code?: string;
  readonly statusCode?: number;
  readonly details?: ApiErrorBody['details'];

  constructor(
    message: string,
    options?: { code?: string; statusCode?: number; details?: ApiErrorBody['details'] },
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options?.code;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
  }
}

function humanizeFieldPath(field: string): string {
  if (field.includes('images') && field.includes('url')) return 'foto';
  if (field.includes('images') && field.includes('alt')) return 'nombre de foto';
  if (field.includes('meetingLocation')) return 'ubicación';
  if (field === 'title') return 'título';
  if (field === 'description') return 'descripción';
  if (field === 'conditions.summary') return 'condiciones';
  return field;
}

function humanizeValidationMessage(field: string, message: string): string {
  const label = humanizeFieldPath(field);
  if (/longer than the maximum|maxlength|maximum allowed length/i.test(message)) {
    if (label === 'foto') {
      return 'La foto es demasiado pesada. Usá una imagen más liviana (máx. ~1 MB) o una URL.';
    }
    return `${label}: supera el tamaño máximo permitido`;
  }
  if (/required/i.test(message)) return `${label}: es obligatorio`;
  return `${label}: ${message}`;
}

/** Extrae mensaje legible de errores Zod / AppError / Mongoose de la API. */
export function getApiErrorMessage(error: unknown, fallback = 'Unexpected API error'): string {
  if (error instanceof ApiClientError) {
    const fromDetails = formatDetails(error.details);
    if (fromDetails) return fromDetails;
    return error.message || fallback;
  }
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const data = error.response?.data as ApiErrorBody | undefined;
  const fromDetails = formatDetails(data?.details);
  if (fromDetails) return fromDetails;

  return data?.message ?? error.message ?? fallback;
}

function formatDetails(details: ApiErrorBody['details'] | undefined): string | null {
  if (!details) return null;

  const fieldErrors = details.fieldErrors;
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors)
      .flatMap(([field, messages]) =>
        (messages ?? []).map((msg) => {
          if (field === 'password') {
            return 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y un símbolo.';
          }
          if (field === 'email') return `Email: ${msg}`;
          if (field === 'fullName') return `Nombre: ${msg}`;
          return humanizeValidationMessage(field, msg);
        }),
      )
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  if (details.formErrors?.length) {
    return details.formErrors.join(' ');
  }

  // Mongoose: details = { "images.0.url": "Path `url` (`...`) is longer than..." }
  const mongooseParts = Object.entries(details)
    .filter(([key, value]) => key !== 'fieldErrors' && key !== 'formErrors' && key !== 'email')
    .map(([key, value]) => {
      if (typeof value !== 'string') return null;
      return humanizeValidationMessage(key, value);
    })
    .filter((part): part is string => Boolean(part));
  if (mongooseParts.length > 0) return mongooseParts.join(' · ');

  return null;
}

function toApiClientError(error: AxiosError<ApiErrorBody>): ApiClientError {
  const data = error.response?.data;
  return new ApiClientError(getApiErrorMessage(error), {
    code: data?.code,
    statusCode: data?.statusCode ?? error.response?.status,
    details: data?.details,
  });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const original = error.config as RetryConfig | undefined;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isAuthRefreshUrl(original.url)
    ) {
      original._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient.request(original);
      } catch (refreshError) {
        const refreshStatus = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;
        // Solo cerrar sesión si el refresh fue rechazado (token inválido/vencido).
        if (refreshStatus === 401 || refreshStatus === 403 || !localStorage.getItem('refreshToken')) {
          notifySessionCleared();
        }
      }
    }

    return Promise.reject(toApiClientError(error));
  },
);

export type { AxiosError };
