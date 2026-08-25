import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/config/env', () => ({
  env: {
    MERCADOPAGO_CLIENT_ID: 'app-123',
    MERCADOPAGO_CLIENT_SECRET: 'secret-xyz',
    MERCADOPAGO_OAUTH_REDIRECT_URI:
      'http://localhost:3000/payments/mercadopago/oauth/callback',
  },
}));

import { MercadoPagoOAuthClient } from '../../infrastructure/payments/mercadopago-oauth.client';

describe('MercadoPagoOAuthClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createAuthorizationUrl incluye PKCE S256 y redirect_uri', () => {
    const client = new MercadoPagoOAuthClient();
    const url = new URL(
      client.createAuthorizationUrl({
        state: 'abc',
        codeChallenge: 'challenge-value',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://auth.mercadopago.com/authorization');
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toContain('/oauth/callback');
  });

  it('exchangeCode POST /oauth/token', async () => {
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
    const tokens = await client.exchangeCode({ code: 'c', codeVerifier: 'v' });
    expect(tokens.access_token).toBe('AT');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/oauth/token');
    const body = JSON.parse(String(init?.body));
    expect(body.grant_type).toBe('authorization_code');
    expect(body.code_verifier).toBe('v');
    expect(body.client_secret).toBe('secret-xyz');
  });
});
