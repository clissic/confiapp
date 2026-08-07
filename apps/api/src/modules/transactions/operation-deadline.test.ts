import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../shared/errors/app-error';
import {
  assertNotPastDeadline,
  computeOperationDeadline,
  isPastOperationDeadline,
  OPERATION_DEADLINE_DAYS,
} from './operation-deadline';

describe('operation-deadline', () => {
  it('computa 21 días desde ahora', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const deadline = computeOperationDeadline(from);
    const expected = new Date(from.getTime() + OPERATION_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });

  it('isPastOperationDeadline respeta la fecha', () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    expect(isPastOperationDeadline(past)).toBe(true);
    expect(isPastOperationDeadline(future)).toBe(false);
    expect(isPastOperationDeadline(null)).toBe(false);
  });

  it('assertNotPastDeadline lanza ValidationError si venció', () => {
    expect(() =>
      assertNotPastDeadline({ operationDeadlineAt: new Date(Date.now() - 1) }),
    ).toThrow(ValidationError);
    expect(() =>
      assertNotPastDeadline({ operationDeadlineAt: new Date(Date.now() + 60_000) }),
    ).not.toThrow();
  });
});
