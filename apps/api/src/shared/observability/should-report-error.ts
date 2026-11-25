import { Error as MongooseError, mongo } from 'mongoose';

import { AppError } from '../errors/app-error';

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const record = err as { status?: unknown; statusCode?: unknown; status_code?: unknown };
  const raw = record.status ?? record.statusCode ?? record.status_code;
  const status = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(status) ? status : undefined;
}

/** Body demasiado grande (`express.json` / `entity.too.large`). */
export function isEntityTooLarge(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { type?: string; status?: number; statusCode?: number; name?: string };
  return (
    record.type === 'entity.too.large' ||
    record.status === 413 ||
    record.statusCode === 413 ||
    record.name === 'PayloadTooLargeError'
  );
}

/** JSON malformado (`express.json` / `entity.parse.failed`). */
export function isEntityParseFailed(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { type?: string; status?: number; statusCode?: number };
  if (record.type === 'entity.parse.failed') return true;
  return err instanceof SyntaxError && (record.status === 400 || record.statusCode === 400);
}

/**
 * Errores de cliente que la API responde como 4xx.
 * No deben reportarse a Sentry (ni el default de Express, que trata
 * un error sin `status` como 500).
 */
export function isExpectedClientError(err: unknown): boolean {
  if (isEntityTooLarge(err) || isEntityParseFailed(err)) return true;
  if (err instanceof AppError) return err.statusCode < 500;
  if (err instanceof MongooseError.ValidationError) return true;
  if (err instanceof mongo.MongoServerError) return true;
  const status = statusOf(err);
  return status !== undefined && status < 500;
}

/** `true` si el error debe llegar a Sentry (no controlado o >= 500). */
export function shouldReportToSentry(err: unknown): boolean {
  return !isExpectedClientError(err);
}
