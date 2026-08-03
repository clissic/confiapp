import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { PlatformRole } from '@confiapp/database';

import { env } from '../../shared/config/env';
import { UnauthorizedError } from '../../shared/errors/app-error';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: PlatformRole;
  typ: 'access';
}

export interface RefreshTokenJwtPayload {
  sub: string;
  typ: 'refresh';
  jti: string;
}

function sign(payload: object, secret: string, expiresIn: string): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, secret, options);
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, 'typ'>,
): string {
  return sign(
    { ...payload, typ: 'access' },
    env.JWT_SECRET,
    env.JWT_ACCESS_EXPIRES_IN,
  );
}

export function signRefreshToken(
  payload: Omit<RefreshTokenJwtPayload, 'typ'>,
): string {
  return sign(
    { ...payload, typ: 'refresh' },
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null) {
      throw new UnauthorizedError('Invalid access token');
    }

    const payload = decoded as AccessTokenPayload;
    if (payload.typ !== 'access' || !payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedError('Invalid access token payload');
    }

    return payload;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenJwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (typeof decoded !== 'object' || decoded === null) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const payload = decoded as RefreshTokenJwtPayload;
    if (payload.typ !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedError('Invalid refresh token payload');
    }

    return payload;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}

export function getRefreshExpiresAt(): Date {
  // Parse simple durations used in env (15m, 7d, 24h)
  const raw = env.JWT_REFRESH_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(raw);
  const now = Date.now();
  if (!match) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60_000
        : unit === 'h'
          ? amount * 3_600_000
          : amount * 86_400_000;
  return new Date(now + ms);
}
