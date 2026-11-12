import { env } from '../../shared/config/env';
import { AppError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';

export interface IdDigitalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

/** Documento devuelto por el userinfo de ID Digital (la CI está en document_number). */
export interface IdDigitalUserInfoDocument {
  document_country?: string;
  document_number?: string;
  document_type?: string;
}

export interface IdDigitalValidationMethod {
  name?: string;
  last_validation_date?: string;
}

/**
 * Respuesta de GET userinfo (Bearer access_token). Campos confirmados en STG (2026-11).
 */
export interface IdDigitalUserInfo {
  sub: string;
  acr?: string;
  amr?: string[] | null;
  birth_date?: string;
  document?: IdDigitalUserInfoDocument;
  email?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  phone?: string;
  registration_level?: number | string;
  registration_level_description?: string;
  validation_methods?: IdDigitalValidationMethod[];
}

export class IdDigitalUserInfoError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'IdDigitalUserInfoError';
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** URL del JWKS: ID_DIGITAL_JWKS_URL o `${ID_DIGITAL_ISSUER}/jwks`. */
export function idDigitalJwksUrl(): string {
  return env.ID_DIGITAL_JWKS_URL?.trim() || `${trimSlash(env.ID_DIGITAL_ISSUER)}/jwks`;
}

/** URL del userinfo: ID_DIGITAL_USERINFO_URL o `${ID_DIGITAL_ISSUER}/userinfo`. */
export function idDigitalUserInfoUrl(): string {
  return (
    env.ID_DIGITAL_USERINFO_URL?.trim() || `${trimSlash(env.ID_DIGITAL_ISSUER)}/userinfo`
  );
}

function idDigitalConfigured(): boolean {
  return Boolean(
    env.ID_DIGITAL_CLIENT_ID?.trim() &&
      env.ID_DIGITAL_CLIENT_SECRET?.trim() &&
      env.ID_DIGITAL_REDIRECT_URI?.trim(),
  );
}

function basicAuthHeader(): string {
  const raw = `${env.ID_DIGITAL_CLIENT_ID}:${env.ID_DIGITAL_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

export class IdDigitalClient {
  isConfigured(): boolean {
    return idDigitalConfigured();
  }

  createAuthorizationUrl(input: { state: string; nonce: string }): string {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Identidad Digital Abitab no está configurada',
        undefined,
        'ID_DIGITAL_NOT_CONFIGURED',
      );
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.ID_DIGITAL_CLIENT_ID,
      redirect_uri: env.ID_DIGITAL_REDIRECT_URI,
      scope: env.ID_DIGITAL_SCOPE,
      acr_values: env.ID_DIGITAL_ACR_VALUES,
      state: input.state,
      nonce: input.nonce,
    });
    return `${env.ID_DIGITAL_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<IdDigitalTokenResponse> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Identidad Digital Abitab no está configurada',
        undefined,
        'ID_DIGITAL_NOT_CONFIGURED',
      );
    }
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.ID_DIGITAL_REDIRECT_URI,
    });

    const res = await fetch(env.ID_DIGITAL_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('id-digital token exchange failed', {
        status: res.status,
        body: text.slice(0, 200),
      });
      throw new AppError(
        502,
        'No se pudo intercambiar el código de Identidad Digital',
        { status: res.status },
        'ID_DIGITAL_TOKEN_EXCHANGE_FAILED',
      );
    }

    return (await res.json()) as IdDigitalTokenResponse;
  }

  /** GET userinfo con el access_token. Lanza IdDigitalUserInfoError si falla. */
  async fetchUserInfo(accessToken: string): Promise<IdDigitalUserInfo> {
    let res: Response;
    try {
      res = await fetch(idDigitalUserInfoUrl(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new IdDigitalUserInfoError(
        `userinfo no respondió: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!res.ok) {
      throw new IdDigitalUserInfoError(`userinfo respondió HTTP ${res.status}`, res.status);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new IdDigitalUserInfoError('userinfo no devolvió JSON válido', res.status);
    }
    if (!body || typeof body !== 'object' || typeof (body as { sub?: unknown }).sub !== 'string') {
      throw new IdDigitalUserInfoError('userinfo sin sub', res.status);
    }
    return body as IdDigitalUserInfo;
  }
}

export const idDigitalClient = new IdDigitalClient();
