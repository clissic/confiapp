/**
 * Inicialización de Sentry. Debe importarse ANTES que cualquier otro módulo
 * (en particular Express/HTTP) para que la instrumentación automática funcione.
 *
 * Si `SENTRY_DSN` no está definido no se inicializa nada y la API funciona igual.
 */
import * as Sentry from '@sentry/node';

// Carga `.env.local` / `.env` de apps/api (dotenv) y valida el entorno base.
import { env } from './shared/config/env';
import {
  SENSITIVE_HEADER_NAMES,
  parseSampleRate,
  scrubSentryEvent,
} from './shared/observability/sentry-scrub';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV,
    release: process.env.SENTRY_RELEASE?.trim() || process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
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
      stackFrameVariables: false,
      databaseQueryData: false,
    },
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    beforeSend: (event) => scrubSentryEvent(event),
  });
}

export const sentryEnabled = Boolean(dsn);
