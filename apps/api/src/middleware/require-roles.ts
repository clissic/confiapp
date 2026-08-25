import type { NextFunction, Request, Response } from 'express';
import type { PlatformRole } from '@confiapp/database';

import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';

/** Autorización por roles (RBAC). Requiere `authenticate` previo. */
export function requireRoles(...roles: PlatformRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Tenés que iniciar sesión'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}
