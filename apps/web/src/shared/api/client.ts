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

/** Extrae mensaje legible de errores Zod / AppError de la API. */
export function getApiErrorMessage(error: unknown, fallback = 'Unexpected API error'): string {
  if (error instanceof ApiClientError) return error.message;
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const data = error.response?.data as ApiErrorBody | undefined;
  const fieldErrors = data?.details?.fieldErrors;
  if (fieldErrors) {
    const parts = Object.entries(fieldErrors)
      .flatMap(([field, messages]) =>
        (messages ?? []).map((msg) => {
          if (field === 'password') {
            return 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y un símbolo.';
          }
          if (field === 'email') return `Email: ${msg}`;
          if (field === 'fullName') return `Nombre: ${msg}`;
          return `${field}: ${msg}`;
        }),
      )
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  if (data?.details?.formErrors?.length) {
    return data.details.formErrors.join(' ');
  }

  return data?.message ?? error.message ?? fallback;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const data = error.response?.data;
    return Promise.reject(
      new ApiClientError(getApiErrorMessage(error), {
        code: data?.code,
        statusCode: data?.statusCode ?? error.response?.status,
        details: data?.details,
      }),
    );
  },
);

export type { AxiosError };
