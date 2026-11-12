import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';

import type { Jwk } from '../../src/infrastructure/id-digital/jwks';

/** Helpers de test: clave RSA efímera y firma de JWT RS256 (sin libs externas). */
export function generateRsaKey(kid: string): {
  kid: string;
  privateKey: KeyObject;
  jwk: Jwk;
} {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Jwk;
  return { kid, privateKey, jwk: { ...jwk, kid, use: 'sig', alg: 'RS256' } };
}

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signJwt(
  payload: Record<string, unknown>,
  key: { kid?: string; privateKey: KeyObject },
  header: Record<string, unknown> = {},
): string {
  const head = b64({ alg: 'RS256', typ: 'JWT', ...(key.kid ? { kid: key.kid } : {}), ...header });
  const body = b64(payload);
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key.privateKey);
  return `${head}.${body}.${signature.toString('base64url')}`;
}

export function unsignedJwt(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'none', typ: 'JWT' },
  signature = '',
): string {
  return `${b64(header)}.${b64(payload)}.${signature}`;
}
