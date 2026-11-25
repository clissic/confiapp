import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { Error as MongooseError, mongo } from 'mongoose';

import { sentryEnabled } from '../instrument';
import { AppError, ValidationError } from '../shared/errors/app-error';
import {
  isEntityParseFailed,
  isEntityTooLarge,
  isExpectedClientError,
} from '../shared/observability/should-report-error';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`, undefined, 'NOT_FOUND'));
}

/**
 * Completa `statusCode` en 4xx conocidos (Mongoose / Mongo) para que
 * `setupExpressErrorHandler` no los trate como 500 (el default asume 500
 * si el error no trae status).
 */
export function stampClientErrorStatus(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (isExpectedClientError(err) && err && typeof err === 'object') {
    const record = err as { status?: number; statusCode?: number; code?: unknown };
    if (record.statusCode === undefined && record.status === undefined) {
      record.statusCode =
        err instanceof mongo.MongoServerError && record.code === 11000 ? 409 : 400;
    }
  }
  next(err);
}

type SentryResponse = Response & { sentry?: string };

/** Contexto mínimo de la request: sin body, cookies ni headers (Authorization). */
function safeRequestContext(req: Request): { method: string; path: string; url: string } {
  const raw = req.originalUrl || req.url || req.path || '';
  const url = raw.split('?')[0] ?? req.path;
  return { method: req.method, path: req.path, url };
}

/**
 * Reporta a Sentry errores no controlados y >= 500.
 * Si `setupExpressErrorHandler` ya capturó el evento (`res.sentry`), no lo duplica.
 */
function captureServerError(err: unknown, req: Request, res: Response): void {
  if (!sentryEnabled) return;
  const sentryRes = res as SentryResponse;
  if (sentryRes.sentry) return;

  Sentry.withScope((scope) => {
    scope.setTag('method', req.method);
    scope.setTag('path', req.path);
    scope.setContext('request', safeRequestContext(req));
    sentryRes.sentry = Sentry.captureException(err);
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isEntityTooLarge(err)) {
    res.status(413).json({
      statusCode: 413,
      error: 'PayloadTooLargeError',
      code: 'PAYLOAD_TOO_LARGE',
      message:
        'Las fotos o el cuerpo de la petición son demasiado grandes. Probá con menos imágenes o más livianas.',
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (isEntityParseFailed(err)) {
    res.status(400).json({
      statusCode: 400,
      error: 'BadRequest',
      code: 'INVALID_JSON',
      message: 'El cuerpo de la petición no es un JSON válido.',
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { path: req.path, method: req.method, details: err.details });
      captureServerError(err, req, res);
    }

    res.status(err.statusCode).json({
      statusCode: err.statusCode,
      error: err.name,
      code: err.code,
      message: err.message,
      details: err.details,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof MongooseError.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [key, value.message]),
    );
    const validationError = new ValidationError('Mongoose validation failed', details);
    res.status(400).json({
      statusCode: 400,
      error: validationError.name,
      code: validationError.code,
      message: validationError.message,
      details,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof mongo.MongoServerError) {
    const code = err.code;
    const message =
      code === 11000
        ? 'Ya existe un registro con esos datos'
        : err.message?.includes('geo') || err.message?.includes('Point')
          ? 'Ubicación inválida para la operación. Revisá tu ubicación en el perfil o dejala vacía.'
          : 'Error de base de datos al guardar la operación';

    logger.error('MongoServerError', {
      path: req.path,
      method: req.method,
      code,
      message: err.message,
    });

    res.status(code === 11000 ? 409 : 400).json({
      statusCode: code === 11000 ? 409 : 400,
      error: 'MongoServerError',
      code: code === 11000 ? 'DUPLICATE' : 'DB_ERROR',
      message,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.error('Unhandled error', {
    path: req.path,
    method: req.method,
    err:
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : String(err),
  });

  captureServerError(err, req, res);

  res.status(500).json({
    statusCode: 500,
    error: 'InternalServerError',
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error inesperado',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
