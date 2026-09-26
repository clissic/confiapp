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
}

export const idDigitalClient = new IdDigitalClient();
