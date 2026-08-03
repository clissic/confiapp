import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { ValidationError } from '../shared/errors/app-error';
import { validateRequest } from './validate';

describe('middleware/validate', () => {
  it('pasa body válido', () => {
    const next = vi.fn() as unknown as NextFunction;
    const mw = validateRequest({
      body: z.object({ email: z.string().email() }),
    });
    const req = { body: { email: 'a@test.local' } } as unknown as Request;
    mw(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@test.local' });
  });

  it('reenvía ValidationError', () => {
    const next = vi.fn() as unknown as NextFunction;
    const mw = validateRequest({
      body: z.object({ email: z.string().email() }),
    });
    mw({ body: { email: 'bad' } } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('valida query y params', () => {
    const next = vi.fn() as unknown as NextFunction;
    const mw = validateRequest({
      query: z.object({ limit: z.coerce.number() }),
      params: z.object({ id: z.string().min(1) }),
    });
    const req = {
      query: { limit: '10' },
      params: { id: 'abc' },
    } as unknown as Request;
    mw(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect((req as { query: { limit: number } }).query.limit).toBe(10);
  });
});
