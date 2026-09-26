import { describe, expect, it } from 'vitest';

import {
  IdTokenValidationError,
  parseAndValidateIdToken,
} from './id-token';

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('parseAndValidateIdToken', () => {
  const issuer = 'https://auth.identificaciondigital.com.uy/api/v2/openid';
  const clientId = 'client-abc';
  const now = Math.floor(Date.now() / 1000);

  it('acepta claims válidos', () => {
    const token = makeToken({
      iss: issuer,
      aud: clientId,
      sub: 'user-1',
      exp: now + 3600,
      iat: now,
      nonce: 'n1',
      first_name: 'Ana',
      acr: 'loa2',
      amr: ['pin'],
    });
    const claims = parseAndValidateIdToken(token, {
      issuer,
      clientId,
      nonce: 'n1',
    });
    expect(claims.sub).toBe('user-1');
    expect(claims.amr).toEqual(['pin']);
    expect(claims.first_name).toBe('Ana');
  });

  it('rechaza iss inválido', () => {
    const token = makeToken({
      iss: 'https://evil.example',
      aud: clientId,
      sub: 'user-1',
      exp: now + 3600,
    });
    expect(() =>
      parseAndValidateIdToken(token, { issuer, clientId }),
    ).toThrow(IdTokenValidationError);
  });

  it('rechaza aud inválido', () => {
    const token = makeToken({
      iss: issuer,
      aud: 'otro',
      sub: 'user-1',
      exp: now + 3600,
    });
    expect(() =>
      parseAndValidateIdToken(token, { issuer, clientId }),
    ).toThrow(/aud/);
  });

  it('rechaza token expirado', () => {
    const token = makeToken({
      iss: issuer,
      aud: clientId,
      sub: 'user-1',
      exp: now - 120,
    });
    expect(() =>
      parseAndValidateIdToken(token, { issuer, clientId, clockSkewSeconds: 0 }),
    ).toThrow(/expirado/);
  });

  it('rechaza nonce distinto', () => {
    const token = makeToken({
      iss: issuer,
      aud: clientId,
      sub: 'user-1',
      exp: now + 3600,
      nonce: 'a',
    });
    expect(() =>
      parseAndValidateIdToken(token, { issuer, clientId, nonce: 'b' }),
    ).toThrow(/nonce/);
  });
});
