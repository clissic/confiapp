/**
 * Inicialización de Sentry en el navegador. Se importa primero en `main.tsx`.
 * Si `VITE_SENTRY_DSN` no está definido no se inicializa nada y la app funciona igual.
 */
import * as Sentry from '@sentry/react';

import {
  SENSITIVE_HEADER_NAMES,
  parseSampleRate,
  scrubSentryEvent,
} from '@/shared/lib/sentry-scrub';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const tracesSampleRate = parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE);

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
    // SDK v11: `dataCollection` reemplaza a `sendDefaultPii` (equivalente a sendDefaultPii: false,
    // más estricto): sin datos de usuario, cookies ni bodies; headers sensibles denegados.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { deny: SENSITIVE_HEADER_NAMES },
      httpBodies: [],
      urlQueryParams: {
        deny: ['code', 'state', 'code_verifier', 'token', 'access_token', 'id_token'],
      },
    },
    integrations: tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
    tracesSampleRate,
    beforeSend: (event) => scrubSentryEvent(event),
  });
}

export const sentryEnabled = Boolean(dsn);
