export interface IdDigitalIdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat?: number;
  nonce?: string;
  first_name?: string;
  second_name?: string;
  last_name?: string;
  second_last_name?: string;
  email?: string;
  acr?: string;
  amr?: string[];
}

export class IdTokenValidationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'MALFORMED'
      | 'ISS'
      | 'AUD'
      | 'EXP'
      | 'SUB'
      | 'NONCE' = 'MALFORMED',
  ) {
    super(message);
    this.name = 'IdTokenValidationError';
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) {
    throw new IdTokenValidationError('id_token malformado', 'MALFORMED');
  }
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new IdTokenValidationError('id_token no es un JWT válido', 'MALFORMED');
  }
}

function audienceMatches(aud: unknown, clientId: string): boolean {
  if (typeof aud === 'string') return aud === clientId;
  if (Array.isArray(aud)) return aud.includes(clientId);
  return false;
}

/**
 * Valida claims del id_token recibido del token endpoint (HTTPS + client_secret).
 * No verifica firma JWS (JWKS no documentado en el paquete público); la autenticidad
 * proviene del exchange confidencial del authorization code.
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
  const payload = decodeJwtPayload(idToken);
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
  if (options.nonce) {
    if (payload.nonce !== options.nonce) {
      throw new IdTokenValidationError('nonce del id_token no coincide', 'NONCE');
    }
  }

  const amrRaw = payload.amr;
  const amr = Array.isArray(amrRaw)
    ? amrRaw.filter((v): v is string => typeof v === 'string')
    : typeof amrRaw === 'string'
      ? [amrRaw]
      : undefined;

  return {
    iss: String(payload.iss),
    aud: payload.aud as string | string[],
    sub: payload.sub.trim(),
    exp: payload.exp,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
    first_name: typeof payload.first_name === 'string' ? payload.first_name : undefined,
    second_name: typeof payload.second_name === 'string' ? payload.second_name : undefined,
    last_name: typeof payload.last_name === 'string' ? payload.last_name : undefined,
    second_last_name:
      typeof payload.second_last_name === 'string' ? payload.second_last_name : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    acr: typeof payload.acr === 'string' ? payload.acr : undefined,
    amr,
  };
}
