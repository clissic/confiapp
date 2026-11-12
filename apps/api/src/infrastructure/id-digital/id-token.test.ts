import { createHmac } from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  effectiveAuthMethods,
  IdTokenValidationError,
  parseAndValidateIdToken,
  verifyAndValidateIdToken,
  verifyIdTokenSignature,
} from './id-token';
import { JwksCache } from './jwks';
import { generateRsaKey, signJwt, unsignedJwt } from '../../../test/helpers/rsa-jwt';

const issuer = 'https://auth.identificaciondigital.com.uy/api/v2/openid';
const jwksUrl = `${issuer}/jwks`;
const clientId = 'client-abc';
const now = Math.floor(Date.now() / 1000);

/** Claims tal como los devuelve ID Digital STG (sin nonce, amr null). */
function realisticClaims(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    acr: 'pin',
    amr: null,
    at_hash: 'abc',
    aud: clientId,
    auth_time: now - 5,
    email: 'agente@example.com',
    exp: now + 300,
    first_name: 'Ana',
    iat: now,
    iss: issuer,
    last_name: 'Pérez',
    second_last_name: 'Gómez',
    second_name: 'María',
    sub: 'sub-123',
    ...extra,
  };
}

describe('parseAndValidateIdToken (claims)', () => {
  it('acepta claims válidos con nonce coincidente', () => {
    const token = unsignedJwt(realisticClaims({ nonce: 'n1', amr: ['pin'] }));
    const claims = parseAndValidateIdToken(token, { issuer, clientId, nonce: 'n1' });
    expect(claims.sub).toBe('sub-123');
    expect(claims.amr).toEqual(['pin']);
    expect(claims.first_name).toBe('Ana');
  });

  it('acepta id_token SIN nonce aunque se haya enviado uno (comportamiento real de ID Digital)', () => {
    const token = unsignedJwt(realisticClaims());
    const claims = parseAndValidateIdToken(token, { issuer, clientId, nonce: 'esperado' });
    expect(claims.nonce).toBeUndefined();
    expect(claims.acr).toBe('pin');
    expect(claims.amr).toBeUndefined();
    expect(claims.auth_time).toBe(now - 5);
  });

  it('rechaza nonce distinto', () => {
    const token = unsignedJwt(realisticClaims({ nonce: 'a' }));
    expect(() => parseAndValidateIdToken(token, { issuer, clientId, nonce: 'b' })).toThrow(
      /nonce/,
    );
  });

  it('rechaza iss inválido', () => {
    const token = unsignedJwt(realisticClaims({ iss: 'https://evil.example' }));
    expect(() => parseAndValidateIdToken(token, { issuer, clientId })).toThrow(
      IdTokenValidationError,
    );
  });

  it('rechaza aud inválido', () => {
    const token = unsignedJwt(realisticClaims({ aud: 'otro' }));
    expect(() => parseAndValidateIdToken(token, { issuer, clientId })).toThrow(/aud/);
  });

  it('acepta aud como array que incluye el client_id', () => {
    const token = unsignedJwt(realisticClaims({ aud: ['x', clientId] }));
    expect(parseAndValidateIdToken(token, { issuer, clientId }).sub).toBe('sub-123');
  });

  it('rechaza token expirado', () => {
    const token = unsignedJwt(realisticClaims({ exp: now - 120 }));
    expect(() =>
      parseAndValidateIdToken(token, { issuer, clientId, clockSkewSeconds: 0 }),
    ).toThrow(/expirado/);
  });

  it('rechaza sub ausente', () => {
    const token = unsignedJwt(realisticClaims({ sub: '' }));
    expect(() => parseAndValidateIdToken(token, { issuer, clientId })).toThrow(/sub/);
  });

  it('rechaza JWT malformado', () => {
    expect(() => parseAndValidateIdToken('abc', { issuer, clientId })).toThrow(/malformado/);
    expect(() => parseAndValidateIdToken('a.!!!.c', { issuer, clientId })).toThrow(
      IdTokenValidationError,
    );
  });
});

describe('verifyIdTokenSignature (RS256 + JWKS)', () => {
  const key = generateRsaKey('kid-1');
  const otherKey = generateRsaKey('kid-2');
  let fetcher: ReturnType<typeof vi.fn>;
  let jwks: JwksCache;

  beforeAll(() => {
    fetcher = vi.fn().mockResolvedValue({ keys: [key.jwk] });
    jwks = new JwksCache({ fetcher, minRefetchIntervalMs: 0 });
  });

  it('acepta firma válida y valida claims', async () => {
    const token = signJwt(realisticClaims(), key);
    const claims = await verifyAndValidateIdToken(token, {
      issuer,
      clientId,
      jwksUrl,
      nonce: 'enviado-pero-no-devuelto',
      jwks,
    });
    expect(claims.sub).toBe('sub-123');
    expect(fetcher).toHaveBeenCalledWith(jwksUrl);
  });

  it('rechaza firma de otra clave con el mismo kid', async () => {
    const token = signJwt(realisticClaims(), { kid: 'kid-1', privateKey: otherKey.privateKey });
    await expect(verifyIdTokenSignature(token, { jwksUrl, jwks })).rejects.toMatchObject({
      code: 'SIGNATURE',
    });
  });

  it('rechaza payload alterado', async () => {
    const token = signJwt(realisticClaims(), key);
    const [h, , s] = token.split('.');
    const tampered = `${h}.${Buffer.from(JSON.stringify(realisticClaims({ sub: 'otro' }))).toString('base64url')}.${s}`;
    await expect(verifyIdTokenSignature(tampered, { jwksUrl, jwks })).rejects.toMatchObject({
      code: 'SIGNATURE',
    });
  });

  it('rechaza kid desconocido', async () => {
    const token = signJwt(realisticClaims(), otherKey);
    await expect(verifyIdTokenSignature(token, { jwksUrl, jwks })).rejects.toMatchObject({
      code: 'JWKS',
    });
  });

  it('rechaza alg none', async () => {
    const token = unsignedJwt(realisticClaims());
    await expect(verifyIdTokenSignature(token, { jwksUrl, jwks })).rejects.toMatchObject({
      code: 'ALG',
    });
  });

  it('rechaza HS256 (aunque el HMAC sea "válido")', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'kid-1' })).toString(
      'base64url',
    );
    const body = Buffer.from(JSON.stringify(realisticClaims())).toString('base64url');
    const sig = createHmac('sha256', 'client-secret').update(`${header}.${body}`).digest('base64url');
    await expect(
      verifyIdTokenSignature(`${header}.${body}.${sig}`, { jwksUrl, jwks }),
    ).rejects.toMatchObject({ code: 'ALG' });
  });

  it('rechaza RS256 sin firma', async () => {
    const token = unsignedJwt(realisticClaims(), { alg: 'RS256', kid: 'kid-1' });
    await expect(verifyIdTokenSignature(token, { jwksUrl, jwks })).rejects.toMatchObject({
      code: 'SIGNATURE',
    });
  });

  it('traduce error del JWKS a código JWKS', async () => {
    const failing = new JwksCache({ fetcher: vi.fn().mockRejectedValue(new Error('boom')) });
    const token = signJwt(realisticClaims(), key);
    await expect(
      verifyIdTokenSignature(token, { jwksUrl, jwks: failing }),
    ).rejects.toMatchObject({ code: 'JWKS' });
  });
});

describe('effectiveAuthMethods', () => {
  it('usa amr si viene con valores', () => {
    expect(effectiveAuthMethods({ acr: 'pin', amr: ['otp'] })).toEqual(['otp']);
  });
  it('usa acr cuando amr viene vacío', () => {
    expect(effectiveAuthMethods({ acr: 'pin', amr: undefined })).toEqual(['pin']);
    expect(effectiveAuthMethods({ acr: 'pin', amr: [] })).toEqual(['pin']);
  });
  it('undefined si no hay ninguno', () => {
    expect(effectiveAuthMethods({})).toBeUndefined();
  });
});
