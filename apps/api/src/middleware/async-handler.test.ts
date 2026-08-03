import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { asyncHandler } from './async-handler';

describe('middleware/async-handler', () => {
  it('propaga errores async a next', async () => {
    const next = vi.fn() as unknown as NextFunction;
    const err = new Error('boom');
    const handler = asyncHandler(async () => {
      throw err;
    });
    handler({} as Request, {} as Response, next);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  it('resuelve handlers exitosos', async () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const handler = asyncHandler(async (_req, response) => {
      response.status(200).json({ ok: true });
    });
    handler({} as Request, res, next);
    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
