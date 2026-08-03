import type { NextFunction, Request, Response } from 'express';
import { UserStatus } from '@confiapp/database';

import { verifyAccessToken } from '../infrastructure/security/jwt';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';
import { UserModel } from '../database/models';

/** Extrae Bearer token o falla. */
function extractBearer(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token');
  }
  return header.slice('Bearer '.length).trim();
}

/**
 * Protege rutas con JWT access.
 * Revalida usuario activo y respeta passwordChangedAt (tokens viejos).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearer(req);
    const payload = verifyAccessToken(token);

    const user = await UserModel.findOne({ _id: payload.sub, deletedAt: null })
      .select('_id email role status passwordChangedAt')
      .lean()
      .exec();
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Account suspended');
    }

    if (user.passwordChangedAt) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      const iat = (payload as unknown as { iat?: number }).iat ?? 0;
      if (iat < changedAtSec) {
        throw new UnauthorizedError('Token invalidated by password change');
      }
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  void authenticate(req, res, next);
}
