import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/config/env', () => ({
  env: {
    ID_DIGITAL_CLIENT_ID: 'cid',
    ID_DIGITAL_CLIENT_SECRET: 'csecret',
    ID_DIGITAL_REDIRECT_URI: 'http://localhost:3000/auth/id-digital/callback',
    ID_DIGITAL_AUTH_URL: 'https://login.identidaddigital.com.uy/v2/authorize',
    ID_DIGITAL_TOKEN_URL: 'https://auth.identificaciondigital.com.uy/api/v2/openid/token',
    ID_DIGITAL_SCOPE: 'openid profile',
    ID_DIGITAL_ACR_VALUES: 'pin',
  },
}));

import { IdDigitalClient } from './id-digital.client';

describe('IdDigitalClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arma URL de autorización con code flow y pin', () => {
    const client = new IdDigitalClient();
    const url = new URL(
      client.createAuthorizationUrl({ state: 'st', nonce: 'nn' }),
    );
    expect(url.origin + url.pathname).toBe(
      'https://login.identidaddigital.com.uy/v2/authorize',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('acr_values')).toBe('pin');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('nonce')).toBe('nn');
  });

  it('exchangeCode envía Basic auth y form body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'at',
        token_type: 'bearer',
        expires_in: 3600,
        id_token: 'idt',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new IdDigitalClient();
    const tokens = await client.exchangeCode('auth-code');
    expect(tokens.id_token).toBe('idt');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/openid/token');
    expect(init.method).toBe('POST');
    const auth = String((init.headers as Record<string, string>).Authorization);
    expect(auth.startsWith('Basic ')).toBe(true);
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    expect(decoded).toBe('cid:csecret');
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(String(init.body)).toContain('code=auth-code');
  });
});
