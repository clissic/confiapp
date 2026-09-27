import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/config/env', () => ({
  env: {
    MERCADOPAGO_CLIENT_ID: 'app-123',
    MERCADOPAGO_CLIENT_SECRET: 'secret-xyz',
    MERCADOPAGO_OAUTH_REDIRECT_URI:
      'http://localhost:3000/payments/mercadopago/oauth/callback',
    MERCADOPAGO_COUNTRY: 'UY',
  },
}));

import { MercadoPagoOAuthClient } from '../../infrastructure/payments/mercadopago-oauth.client';

describe('MercadoPagoOAuthClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createAuthorizationUrl sin PKCE no envía challenge', () => {
    const client = new MercadoPagoOAuthClient();
    const url = new URL(
      client.createAuthorizationUrl({
        state: 'abc',
      }),
    );
    expect(url.origin + url.pathname).toBe(
      'https://auth.mercadopago.com.uy/authorization',
    );
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('code_challenge')).toBeNull();
    expect(url.searchParams.get('redirect_uri')).toContain('/oauth/callback');
  });

  it('createAuthorizationUrl con PKCE S256 incluye challenge', () => {
    const client = new MercadoPagoOAuthClient();
    const url = new URL(
      client.createAuthorizationUrl({
        state: 'abc',
        codeChallenge: 'challenge-value',
      }),
    );
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('exchangeCode POST /oauth/token sin code_verifier si no hay PKCE', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        access_token: 'AT',
        token_type: 'bearer',
        expires_in: 100,
        user_id: 1,
        refresh_token: 'RT',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new MercadoPagoOAuthClient();
    const tokens = await client.exchangeCode({ code: 'c' });
    expect(tokens.access_token).toBe('AT');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/oauth/token');
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBeNull();
    expect(body.get('client_secret')).toBe('secret-xyz');
  });

  it('exchangeCode incluye code_verifier cuando hay PKCE', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        access_token: 'AT',
        token_type: 'bearer',
        expires_in: 100,
        user_id: 1,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new MercadoPagoOAuthClient();
    await client.exchangeCode({ code: 'c', codeVerifier: 'v' });
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body.get('code_verifier')).toBe('v');
  });
});
