/**
 * Limpieza de datos sensibles antes de enviar eventos a Sentry.
 * Se usa en `beforeSend` / `beforeSendTransaction` (ver `src/instrument.ts`; copia en apps/web y apps/api, mantener sincronizadas).
 */

export const REDACTED = '[Filtered]';

/** Headers que nunca deben enviarse a Sentry. */
export const SENSITIVE_HEADER_NAMES = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-refresh-token',
];

const SENSITIVE_HEADERS = new Set(SENSITIVE_HEADER_NAMES);

/** Claves con datos sensibles (credenciales, tokens, documentos de identidad, tarjetas). */
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|session|api[-_]?key|private[-_]?key|c[eé]dula|documento|document[-_]?(number|id)|dni|card[-_]?number|cvv|cvc|otp|pin$/i;

/** En query strings además se filtran códigos/estados de OAuth. */
const SENSITIVE_QUERY_KEY = /^(code|state|code_verifier)$/i;

const MAX_DEPTH = 8;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(inner, depth + 1);
  }
  return out;
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) || isSensitiveKey(key) ? REDACTED : value;
  }
  return out;
}

export function scrubQueryString(query: string): string {
  const hasLeadingQ = query.startsWith('?');
  const params = new URLSearchParams(hasLeadingQ ? query.slice(1) : query);
  for (const key of Array.from(params.keys())) {
    if (isSensitiveKey(key) || SENSITIVE_QUERY_KEY.test(key)) {
      params.set(key, REDACTED);
    }
  }
  const result = params.toString();
  return hasLeadingQ ? `?${result}` : result;
}

function scrubUrl(url: string): string {
  const idx = url.indexOf('?');
  if (idx === -1) return url;
  return `${url.slice(0, idx)}?${scrubQueryString(url.slice(idx + 1))}`;
}

function scrubData(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return JSON.stringify(scrubValue(JSON.parse(data)));
    } catch {
      return data;
    }
  }
  return scrubValue(data);
}

interface ScrubbableEvent {
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    data?: unknown;
    query_string?: unknown;
    [key: string]: unknown;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{ data?: Record<string, unknown>; [key: string]: unknown }>;
  user?: Record<string, unknown>;
}

/** Muta y devuelve el evento sin headers de auth, cookies ni campos sensibles. */
export function scrubSentryEvent<T>(event: T): T {
  const e = event as unknown as ScrubbableEvent;

  if (e.request) {
    const req = e.request;
    if (req.headers) req.headers = scrubHeaders(req.headers);
    if (req.cookies) delete req.cookies;
    if (req.data !== undefined) req.data = scrubData(req.data);
    if (typeof req.query_string === 'string') {
      req.query_string = scrubQueryString(req.query_string);
    } else if (req.query_string && typeof req.query_string === 'object') {
      req.query_string = scrubValue(req.query_string);
    }
    if (typeof req.url === 'string') req.url = scrubUrl(req.url);
  }

  if (e.extra) e.extra = scrubValue(e.extra) as Record<string, unknown>;
  if (e.contexts) e.contexts = scrubValue(e.contexts) as Record<string, unknown>;

  if (Array.isArray(e.breadcrumbs)) {
    for (const crumb of e.breadcrumbs) {
      if (crumb.data) {
        const data = scrubValue(crumb.data) as Record<string, unknown>;
        if (typeof data.url === 'string') data.url = scrubUrl(data.url);
        crumb.data = data;
      }
    }
  }

  if (e.user) {
    // Solo se conserva el id (sendDefaultPii está apagado igual).
    e.user = e.user.id !== undefined ? { id: e.user.id } : {};
  }

  return event;
}

/** Parsea un sample rate (0..1); cualquier valor inválido vuelve a 0. */
export function parseSampleRate(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 1);
}
