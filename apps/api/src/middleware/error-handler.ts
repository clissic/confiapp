import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';

import { AppError, ValidationError } from '../shared/errors/app-error';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`, undefined, 'NOT_FOUND'));
}

function isEntityTooLarge(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { type?: string; status?: number; statusCode?: number; name?: string };
  return (
    record.type === 'entity.too.large' ||
    record.status === 413 ||
    record.statusCode === 413 ||
    record.name === 'PayloadTooLargeError'
  );
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isEntityTooLarge(err)) {
    res.status(413).json({
      statusCode: 413,
      error: 'PayloadTooLargeError',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Las fotos o el cuerpo de la petición son demasiado grandes. Probá con menos imágenes o más livianas.',
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { path: req.path, method: req.method, details: err.details });
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

  res.status(500).json({
    statusCode: 500,
    error: 'InternalServerError',
    code: 'INTERNAL_ERROR',
    message: 'Unexpected error',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
