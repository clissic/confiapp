import { describe, expect, it } from 'vitest';

import {
  generateOpaqueToken,
  hashToken,
  isStrongPassword,
  safeEqualHash,
} from './crypto-tokens';

describe('utils/crypto-tokens', () => {
  it('genera tokens opacos distintos', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it('hashea de forma determinista', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abcd'));
  });

  it('compara hashes de forma segura', () => {
    const h = hashToken('secret');
    expect(safeEqualHash(h, h)).toBe(true);
    expect(safeEqualHash(h, hashToken('other'))).toBe(false);
    expect(safeEqualHash('aa', 'bbb')).toBe(false);
  });

  it('valida password fuerte', () => {
    expect(isStrongPassword('Short1!')).toBe(false);
    expect(isStrongPassword('alllowercase1!')).toBe(false);
    expect(isStrongPassword('TestPass1!')).toBe(true);
  });
});
