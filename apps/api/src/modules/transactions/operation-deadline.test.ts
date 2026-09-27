import { describe, expect, it } from 'vitest';

import {
  assertNotPastDeadline,
  computeOperationDeadline,
  isPastOperationDeadline,
  OPERATION_DEADLINE_DAYS,
} from './operation-deadline';

describe('operation-deadline', () => {
  it('computa 21 días desde ahora', () => {
    const from = new Date('2026-01-01T12:00:00.000Z');
    const deadline = computeOperationDeadline(from);
    const expected = new Date(from.getTime() + OPERATION_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });

  it('isPastOperationDeadline detecta vencimiento', () => {
    expect(isPastOperationDeadline(new Date(Date.now() - 1))).toBe(true);
    expect(isPastOperationDeadline(new Date(Date.now() + 60_000))).toBe(false);
    expect(isPastOperationDeadline(null)).toBe(false);
  });

  it('assertNotPastDeadline no bloquea (la op sigue abierta tras el plazo)', () => {
    expect(() =>
      assertNotPastDeadline({ operationDeadlineAt: new Date(Date.now() - 1) }),
    ).not.toThrow();
    expect(() =>
      assertNotPastDeadline({ operationDeadlineAt: new Date(Date.now() + 60_000) }),
    ).not.toThrow();
  });
});
