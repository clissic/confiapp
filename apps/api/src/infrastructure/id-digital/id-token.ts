import { verify as cryptoVerify } from 'node:crypto';

import { JwksError, idDigitalJwksCache, type JwksCache } from './jwks';

/**
 * Claims del id_token de ID Digital 2.0 (Abitab).
 * Confirmados en prueba real contra STG (2026-11): acr ('pin'), amr (null), at_hash,
 * aud, auth_time, email, exp, first_name, iat, iss, last_name, second_last_name,
 * second_name, sub. El proveedor NO devuelve `nonce` aunque se envíe en authorize.
 */
export interface IdDigitalIdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat?: number;
  auth_time?: number;
  nonce?: string;
  first_name?: string;
  second_name?: string;
  last_name?: string;
  second_last_name?: string;
  email?: string;
  acr?: string;
  /** Vacío/null en ID Digital: se normaliza a undefined. */
  amr?: string[];
}

export type IdTokenValidationErrorCode =
  | 'MALFORMED'
  | 'ALG'
  | 'SIGNATURE'
  | 'JWKS'
  | 'ISS'
  | 'AUD'
  | 'EXP'
  | 'SUB'
  | 'NONCE';

export class IdTokenValidationError extends Error {
  constructor(
    message: string,
    readonly code: IdTokenValidationErrorCode = 'MALFORMED',
  ) {
    super(message);
    this.name = 'IdTokenValidationError';
  }
}

/** Algoritmos aceptados. Nunca `none` ni HS* (simétricos con el client_secret). */
const ALLOWED_ALGS: Record<string, string> = {
  RS256: 'RSA-SHA256',
  RS384: 'RSA-SHA384',
  RS512: 'RSA-SHA512',
};

function splitJwt(token: string): [string, string, string] {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    throw new IdTokenValidationError('id_token malformado', 'MALFORMED');
  }
  return [parts[0], parts[1], parts[2] ?? ''];
}

function decodeSegment(segment: string, what: string): Record<string, unknown> {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const value = JSON.parse(json) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('not an object');
    }
    return value as Record<string, unknown>;
  } catch {
    throw new IdTokenValidationError(`${what} del id_token no es JSON válido`, 'MALFORMED');
  }
}

export function decodeIdTokenHeader(token: string): { alg?: string; kid?: string } {
  const [header] = splitJwt(token);
  const decoded = decodeSegment(header, 'header');
  return {
    alg: typeof decoded.alg === 'string' ? decoded.alg : undefined,
    kid: typeof decoded.kid === 'string' ? decoded.kid : undefined,
  };
}

/**
 * Verifica la firma JWS del id_token contra el JWKS del proveedor.
 * Solo RS256/RS384/RS512; rechaza `none` y HS*.
 */
export async function verifyIdTokenSignature(
  idToken: string,
  options: { jwksUrl: string; jwks?: JwksCache },
): Promise<void> {
  const [headerB64, payloadB64, signatureB64] = splitJwt(idToken);
  const { alg, kid } = decodeIdTokenHeader(idToken);

  const digest = alg ? ALLOWED_ALGS[alg] : undefined;
  if (!digest) {
    throw new IdTokenValidationError(
      `alg del id_token no permitido: ${alg ?? 'ausente'}`,
      'ALG',
    );
  }
  if (!signatureB64) {
    throw new IdTokenValidationError('id_token sin firma', 'SIGNATURE');
  }

  const cache = options.jwks ?? idDigitalJwksCache;
  let key;
  try {
    key = await cache.getKey(options.jwksUrl, kid);
  } catch (error) {
    const message = error instanceof JwksError ? error.message : 'No se pudo obtener el JWKS';
    throw new IdTokenValidationError(message, 'JWKS');
  }

  const ok = cryptoVerify(
    digest,
    Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
    key,
    Buffer.from(signatureB64, 'base64url'),
  );
  if (!ok) {
    throw new IdTokenValidationError('firma del id_token inválida', 'SIGNATURE');
  }
}

function audienceMatches(aud: unknown, clientId: string): boolean {
  if (typeof aud === 'string') return aud === clientId;
  if (Array.isArray(aud)) return aud.includes(clientId);
  return false;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Valida claims del id_token (iss, aud, exp, sub, nonce).
 * No verifica firma: usar `verifyIdTokenSignature` o `verifyAndValidateIdToken`.
 *
 * Nonce: ID Digital no incluye `nonce` en el id_token del authorization code flow.
 * - Sin nonce en el token → se acepta (el `state` de un solo uso + el canje
 *   confidencial del code con client_secret protegen contra replay/CSRF).
 * - Con nonce distinto al esperado → se rechaza.
 */
export function parseAndValidateIdToken(
  idToken: string,
  options: {
    issuer: string;
    clientId: string;
    nonce?: string;
    clockSkewSeconds?: number;
  },
): IdDigitalIdTokenClaims {
  const [, payloadB64] = splitJwt(idToken);
  const payload = decodeSegment(payloadB64, 'payload');
  const skew = options.clockSkewSeconds ?? 60;

  if (payload.iss !== options.issuer) {
    throw new IdTokenValidationError('iss del id_token no coincide', 'ISS');
  }
  if (!audienceMatches(payload.aud, options.clientId)) {
    throw new IdTokenValidationError('aud del id_token no coincide', 'AUD');
  }
  if (typeof payload.exp !== 'number') {
    throw new IdTokenValidationError('exp ausente en id_token', 'EXP');
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp + skew < now) {
    throw new IdTokenValidationError('id_token expirado', 'EXP');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new IdTokenValidationError('sub ausente en id_token', 'SUB');
  }
  if (options.nonce && payload.nonce !== undefined && payload.nonce !== null) {
    if (payload.nonce !== options.nonce) {
      throw new IdTokenValidationError('nonce del id_token no coincide', 'NONCE');
    }
  }

  const amrRaw = payload.amr;
  const amrList = Array.isArray(amrRaw)
    ? amrRaw.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    : typeof amrRaw === 'string' && amrRaw.trim() !== ''
      ? [amrRaw]
      : [];

  return {
    iss: String(payload.iss),
    aud: payload.aud as string | string[],
    sub: payload.sub.trim(),
    exp: payload.exp,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    auth_time: typeof payload.auth_time === 'number' ? payload.auth_time : undefined,
    nonce: optionalString(payload.nonce),
    first_name: optionalString(payload.first_name),
    second_name: optionalString(payload.second_name),
    last_name: optionalString(payload.last_name),
    second_last_name: optionalString(payload.second_last_name),
    email: optionalString(payload.email),
    acr: optionalString(payload.acr),
    amr: amrList.length > 0 ? amrList : undefined,
  };
}

/** Firma (JWKS) + claims. Es lo que usa el callback. */
export async function verifyAndValidateIdToken(
  idToken: string,
  options: {
    issuer: string;
    clientId: string;
    jwksUrl: string;
    nonce?: string;
    clockSkewSeconds?: number;
    jwks?: JwksCache;
  },
): Promise<IdDigitalIdTokenClaims> {
  await verifyIdTokenSignature(idToken, { jwksUrl: options.jwksUrl, jwks: options.jwks });
  return parseAndValidateIdToken(idToken, options);
}

/**
 * Método de autenticación efectivo: `amr` si viene con valores; si no, `acr`
 * (ID Digital devuelve amr=null y el método real en acr, p. ej. 'pin').
 */
export function effectiveAuthMethods(claims: {
  acr?: string;
  amr?: string[];
}): string[] | undefined {
  if (claims.amr && claims.amr.length > 0) return claims.amr;
  if (claims.acr) return [claims.acr];
  return undefined;
}
