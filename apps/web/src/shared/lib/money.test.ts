import { describe, expect, it } from 'vitest';

import { formatDateTime, formatMoney } from './money';

describe('shared/lib/money', () => {
  it('formatea UYU sin decimales', () => {
    const value = formatMoney(5_000_000, 'UYU');
    expect(value).toContain('50');
    expect(value).not.toBe('—');
  });

  it('formatea USD con decimales', () => {
    const value = formatMoney(12345, 'USD');
    expect(value).toMatch(/123\.45|123,45/);
  });

  it('devuelve guión si no hay cents', () => {
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });

  it('formatea fechas inválidas sin romper', () => {
    expect(formatDateTime('not-a-date')).toBeTruthy();
  });

  it('fallback si currency inválida', () => {
    const value = formatMoney(10000, 'NOTREAL');
    expect(value).toMatch(/100|NOTREAL/);
  });
});
