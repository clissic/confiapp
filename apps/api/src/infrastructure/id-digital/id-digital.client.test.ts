import { afterEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  env: {
    ID_DIGITAL_CLIENT_ID: 'cid',
    ID_DIGITAL_CLIENT_SECRET: 'csecret',
    ID_DIGITAL_REDIRECT_URI: 'http://localhost:3000/auth/id-digital/callback',
    ID_DIGITAL_AUTH_URL: 'https://login.identificaciondigital.com.uy/v2/authorize',
    ID_DIGITAL_TOKEN_URL: 'https://auth.identificaciondigital.com.uy/api/v2/openid/token',
    ID_DIGITAL_SCOPE: 'openid profile',
    ID_DIGITAL_ACR_VALUES: 'pin',
    ID_DIGITAL_ISSUER: 'https://auth.identificaciondigital.com.uy/api/v2/openid',
    ID_DIGITAL_JWKS_URL: '',
    ID_DIGITAL_USERINFO_URL: '',
  } as Record<string, string>,
}));

vi.mock('../../shared/config/env', () => mockEnv);

import {
  IdDigitalClient,
  IdDigitalUserInfoError,
  idDigitalJwksUrl,
  idDigitalUserInfoUrl,
} from './id-digital.client';

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
      'https://login.identificaciondigital.com.uy/v2/authorize',
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

  it('URLs de JWKS y userinfo por defecto derivan del issuer', () => {
    expect(idDigitalJwksUrl()).toBe(
      'https://auth.identificaciondigital.com.uy/api/v2/openid/jwks',
    );
    expect(idDigitalUserInfoUrl()).toBe(
      'https://auth.identificaciondigital.com.uy/api/v2/openid/userinfo',
    );
  });

  it('URLs de JWKS y userinfo configurables', () => {
    mockEnv.env.ID_DIGITAL_JWKS_URL = 'https://idp.example/keys';
    mockEnv.env.ID_DIGITAL_USERINFO_URL = 'https://idp.example/me';
    try {
      expect(idDigitalJwksUrl()).toBe('https://idp.example/keys');
      expect(idDigitalUserInfoUrl()).toBe('https://idp.example/me');
    } finally {
      mockEnv.env.ID_DIGITAL_JWKS_URL = '';
      mockEnv.env.ID_DIGITAL_USERINFO_URL = '';
    }
  });

  it('fetchUserInfo envía Bearer y devuelve el JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sub: 's1',
        document: { document_number: '12345678', document_type: 'CI', document_country: 'UY' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const info = await new IdDigitalClient().fetchUserInfo('at-1');
    expect(info.document?.document_number).toBe('12345678');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.identificaciondigital.com.uy/api/v2/openid/userinfo');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer at-1');
  });

  it('fetchUserInfo lanza IdDigitalUserInfoError ante HTTP error o sin sub', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );
    await expect(new IdDigitalClient().fetchUserInfo('x')).rejects.toBeInstanceOf(
      IdDigitalUserInfoError,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    await expect(new IdDigitalClient().fetchUserInfo('x')).rejects.toThrow(/sin sub/);
  });
});
