import express, { type NextFunction, type Request, type Response } from 'express';
import { mongo } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, ValidationError } from '../shared/errors/app-error';
import { errorHandler, stampClientErrorStatus } from './error-handler';

const captureException = vi.fn(() => 'event-1');
const setTag = vi.fn();
const setContext = vi.fn();
const withScope = vi.fn(
  (cb: (scope: { setTag: typeof setTag; setContext: typeof setContext }) => void) => {
    cb({ setTag, setContext });
  },
);

vi.mock('@sentry/node', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  withScope: (cb: (scope: { setTag: typeof setTag; setContext: typeof setContext }) => void) =>
    withScope(cb),
  setupExpressErrorHandler: vi.fn(),
  init: vi.fn(),
  expressIntegration: vi.fn(() => ({ name: 'Express' })),
}));

vi.mock('../instrument', () => ({
  sentryEnabled: true,
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/payments',
    originalUrl: '/payments?token=secret',
    url: '/payments?token=secret',
    body: { cardNumber: '4111', password: 'x' },
    cookies: { refreshToken: 'abc' },
    headers: { authorization: 'Bearer abc' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  sentry?: string;
} {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    sentry?: string;
  };
}

describe('middleware/errorHandler', () => {
  beforeEach(() => {
    captureException.mockClear();
    setTag.mockClear();
    setContext.mockClear();
    withScope.mockClear();
  });

  it('mapea entity.parse.failed a 400 y no lo reporta a Sentry', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), {
      type: 'entity.parse.failed',
      status: 400,
      body: '{',
    });
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'INVALID_JSON',
      }),
    );
    expect(captureException).not.toHaveBeenCalled();
  });

  it('no reporta AppError 4xx', () => {
    const res = mockRes();
    errorHandler(new ValidationError('bad'), mockReq(), res, vi.fn() as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reporta errores no controlados a Sentry con contexto sin datos sensibles', () => {
    const res = mockRes();
    const err = new Error('boom');
    errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(captureException).toHaveBeenCalledWith(err);
    expect(setContext).toHaveBeenCalledWith('request', {
      method: 'POST',
      path: '/payments',
      url: '/payments',
    });
    const context = setContext.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(context).not.toHaveProperty('body');
    expect(context).not.toHaveProperty('cookies');
    expect(context).not.toHaveProperty('headers');
    expect(JSON.stringify(setContext.mock.calls)).not.toContain('Bearer');
    expect(JSON.stringify(setContext.mock.calls)).not.toContain('4111');
    expect(JSON.stringify(setContext.mock.calls)).not.toContain('refreshToken');
  });

  it('reporta AppError >= 500 y no duplica si Sentry ya capturó el evento', () => {
    const res = mockRes();
    res.sentry = 'already';
    errorHandler(new AppError(503, 'caído'), mockReq(), res, vi.fn() as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('responde 400 cuando express.json recibe un JSON malformado', async () => {
    const app = express();
    app.use(express.json());
    app.post('/echo', (req, res) => {
      res.json(req.body);
    });
    app.use(errorHandler);

    const response = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"oops":');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_JSON');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('sella statusCode 409 en Mongo 11000 para que Sentry no lo tome como 500', () => {
    const err = new mongo.MongoServerError({ message: 'E11000', code: 11000 });
    const next = vi.fn();
    stampClientErrorStatus(err, mockReq(), mockRes(), next as unknown as NextFunction);
    expect((err as { statusCode?: number }).statusCode).toBe(409);
    expect(next).toHaveBeenCalledWith(err);
  });
});
