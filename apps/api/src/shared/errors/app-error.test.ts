import { describe, expect, it } from 'vitest';

import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './app-error';

describe('shared/errors', () => {
  it('expone status y code', () => {
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ValidationError('bad', { a: 1 }).details).toEqual({ a: 1 });
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new AppError(409, 'conflict', undefined, 'CONFLICT').code).toBe('CONFLICT');
  });
});
