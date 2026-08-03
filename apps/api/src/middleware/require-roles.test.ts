import { describe, expect, it, vi } from 'vitest';
import { PlatformRole } from '@confiapp/database';
import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';
import { requireRoles } from './require-roles';

function mockReq(user?: { id: string; role: PlatformRole }): Request {
  return { user } as unknown as Request;
}

describe('middleware/require-roles', () => {
  it('exige autenticación', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRoles(PlatformRole.ADMIN)(mockReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza rol insuficiente', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRoles(PlatformRole.ADMIN)(
      mockReq({ id: '1', role: PlatformRole.USER }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('permite rol autorizado', () => {
    const next = vi.fn() as unknown as NextFunction;
    requireRoles(PlatformRole.USER, PlatformRole.ADMIN)(
      mockReq({ id: '1', role: PlatformRole.USER }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });
});
