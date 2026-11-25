import { Error as MongooseError, mongo } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { AppError, ValidationError } from '../errors/app-error';
import {
  isEntityParseFailed,
  isExpectedClientError,
  shouldReportToSentry,
} from './should-report-error';

describe('shouldReportToSentry', () => {
  it('no reporta JSON malformado, payload grande ni AppError 4xx', () => {
    const parseError = Object.assign(new SyntaxError('Unexpected token'), {
      type: 'entity.parse.failed',
      status: 400,
    });
    const tooLarge = Object.assign(new Error('too large'), {
      type: 'entity.too.large',
      status: 413,
    });

    expect(isEntityParseFailed(parseError)).toBe(true);
    expect(isExpectedClientError(parseError)).toBe(true);
    expect(isExpectedClientError(tooLarge)).toBe(true);
    expect(isExpectedClientError(new ValidationError('bad'))).toBe(true);
    expect(isExpectedClientError(new AppError(404, 'missing'))).toBe(true);
    expect(shouldReportToSentry(parseError)).toBe(false);
  });

  it('no reporta ValidationError de Mongoose ni MongoServerError (responden 4xx)', () => {
    const validation = new MongooseError.ValidationError();
    const duplicate = new mongo.MongoServerError({ message: 'E11000', code: 11000 });
    expect(shouldReportToSentry(validation)).toBe(false);
    expect(shouldReportToSentry(duplicate)).toBe(false);
  });

  it('reporta errores no controlados y AppError >= 500', () => {
    expect(shouldReportToSentry(new Error('boom'))).toBe(true);
    expect(shouldReportToSentry(new AppError(500, 'falló'))).toBe(true);
    expect(shouldReportToSentry('weird')).toBe(true);
  });
});
