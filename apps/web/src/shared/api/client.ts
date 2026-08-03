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
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

/** Extrae mensaje legible de errores Zod / AppError de la API. */
export function getApiErrorMessage(error: unknown, fallback = 'Unexpected API error'): string {
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
  (error: AxiosError<ApiErrorBody>) => Promise.reject(new Error(getApiErrorMessage(error))),
);

export type { AxiosError };
