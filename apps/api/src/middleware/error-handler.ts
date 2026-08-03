import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

import { AppError, ValidationError } from '../shared/errors/app-error';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`, undefined, 'NOT_FOUND'));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
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
