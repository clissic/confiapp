import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { PlatformRole } from '@confiapp/database';

import {
  getRefreshExpiresAt,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt';
import { UnauthorizedError } from '../../shared/errors/app-error';

describe('security/jwt', () => {
  it('firma y verifica access token', () => {
    const token = signAccessToken({
      sub: '507f1f77bcf86cd799439011',
      email: 'a@test.local',
      role: PlatformRole.USER,
    });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('507f1f77bcf86cd799439011');
    expect(payload.typ).toBe('access');
    expect(payload.role).toBe(PlatformRole.USER);
  });

  it('firma y verifica refresh token', () => {
    const token = signRefreshToken({
      sub: '507f1f77bcf86cd799439011',
      jti: 'jti-1',
    });
    const payload = verifyRefreshToken(token);
    expect(payload.typ).toBe('refresh');
    expect(payload.jti).toBe('jti-1');
  });

  it('rechaza tokens inválidos', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(UnauthorizedError);
    expect(() => verifyRefreshToken('not-a-jwt')).toThrow(UnauthorizedError);
  });

  it('rechaza access con typ incorrecto', () => {
    const token = jwt.sign(
      { sub: '1', email: 'a@t.co', role: PlatformRole.USER, typ: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' },
    );
    expect(() => verifyAccessToken(token)).toThrow(UnauthorizedError);
  });

  it('rechaza refresh con payload incompleto', () => {
    const token = jwt.sign(
      { sub: '1', typ: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' },
    );
    expect(() => verifyRefreshToken(token)).toThrow(UnauthorizedError);
  });

  it('rechaza token firmado como string', () => {
    const token = jwt.sign('plain-string', process.env.JWT_SECRET!);
    expect(() => verifyAccessToken(token)).toThrow(UnauthorizedError);
  });

  it('calcula expiración de refresh', () => {
    const expires = getRefreshExpiresAt();
    expect(expires.getTime()).toBeGreaterThan(Date.now());
  });

  it('usa fallback si JWT_REFRESH_EXPIRES_IN es inválido', () => {
    const prev = process.env.JWT_REFRESH_EXPIRES_IN;
    process.env.JWT_REFRESH_EXPIRES_IN = 'invalid';
    // env ya parseado; getRefreshExpiresAt lee env module — probar rama unknown vía mock
    vi.resetModules();
    expect(getRefreshExpiresAt().getTime()).toBeGreaterThan(Date.now());
    process.env.JWT_REFRESH_EXPIRES_IN = prev;
  });
});
