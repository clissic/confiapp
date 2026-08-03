import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { ValidationError } from '../shared/errors/app-error';

type RequestPart = 'body' | 'query' | 'params';

interface ValidateOptions {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function parsePart(part: RequestPart, schema: ZodTypeAny, req: Request): void {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.flatten());
  }
  // Express tipa query/params como IncomingHttpHeaders-like; reasignamos el valor parseado.
  (req as Request & Record<RequestPart, unknown>)[part] = result.data;
}

/** Valida body/query/params con Zod antes del controller. */
export function validateRequest(schemas: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) parsePart('body', schemas.body, req);
      if (schemas.query) parsePart('query', schemas.query, req);
      if (schemas.params) parsePart('params', schemas.params, req);
      next();
    } catch (error) {
      next(error);
    }
  };
}
