import { describe, expect, it } from 'vitest';

import {
  decryptSecret,
  encryptSecret,
  generateOAuthState,
  generatePkcePair,
} from '../../utils/secret-crypto';

const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('secret-crypto', () => {
  it('encrypt/decrypt roundtrip', () => {
    const plain = 'APP_USR-test-token-xyz';
    const enc = encryptSecret(plain, KEY);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc, KEY)).toBe(plain);
  });

  it('PKCE pair produces S256 challenge', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge).not.toBe(codeVerifier);
  });

  it('oauth state is opaque', () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });
});
