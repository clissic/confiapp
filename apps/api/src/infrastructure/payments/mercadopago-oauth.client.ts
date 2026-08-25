import { env } from '../../shared/config/env';
import { AppError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';

const MP_AUTH_BASE = 'https://auth.mercadopago.com/authorization';
const MP_API_BASE = 'https://api.mercadopago.com';

export interface MpOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number;
  refresh_token?: string;
  public_key?: string;
  live_mode?: boolean;
}

export interface MpUserMe {
  id: number;
  nickname?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

function oauthConfigured(): boolean {
  return Boolean(
    env.MERCADOPAGO_CLIENT_ID?.trim() &&
      env.MERCADOPAGO_CLIENT_SECRET?.trim() &&
      env.MERCADOPAGO_OAUTH_REDIRECT_URI?.trim(),
  );
}

export class MercadoPagoOAuthClient {
  isConfigured(): boolean {
    return oauthConfigured();
  }

  createAuthorizationUrl(input: {
    state: string;
    codeChallenge: string;
  }): string {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Vinculación Mercado Pago no configurada',
        undefined,
        'MP_OAUTH_NOT_CONFIGURED',
      );
    }
    const params = new URLSearchParams({
      client_id: env.MERCADOPAGO_CLIENT_ID,
      response_type: 'code',
      platform_id: 'mp',
      state: input.state,
      redirect_uri: env.MERCADOPAGO_OAUTH_REDIRECT_URI,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${MP_AUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
  }): Promise<MpOAuthTokenResponse> {
    return this.postToken({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: env.MERCADOPAGO_OAUTH_REDIRECT_URI,
      code_verifier: input.codeVerifier,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<MpOAuthTokenResponse> {
    return this.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  async getUserMe(accessToken: string): Promise<MpUserMe> {
    const res = await fetch(`${MP_API_BASE}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('mercadopago users/me failed', { status: res.status });
      throw new AppError(
        502,
        'No se pudo obtener el perfil de Mercado Pago',
        { status: res.status, body: body.slice(0, 200) },
        'MP_USER_ME_FAILED',
      );
    }
    return (await res.json()) as MpUserMe;
  }

  private async postToken(
    body: Record<string, string>,
  ): Promise<MpOAuthTokenResponse> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Vinculación Mercado Pago no configurada',
        undefined,
        'MP_OAUTH_NOT_CONFIGURED',
      );
    }
    const payload = {
      ...body,
      client_id: env.MERCADOPAGO_CLIENT_ID,
      client_secret: env.MERCADOPAGO_CLIENT_SECRET,
    };
    const res = await fetch(`${MP_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('mercadopago oauth/token failed', { status: res.status });
      throw new AppError(
        502,
        'No se pudo intercambiar el código OAuth de Mercado Pago',
        { status: res.status, body: text.slice(0, 200) },
        'MP_OAUTH_TOKEN_FAILED',
      );
    }
    return (await res.json()) as MpOAuthTokenResponse;
  }
}

export const mercadoPagoOAuthClient = new MercadoPagoOAuthClient();
