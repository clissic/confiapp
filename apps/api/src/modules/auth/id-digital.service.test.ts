import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateRsaKey, signJwt } from '../../../test/helpers/rsa-jwt';

const ISSUER = 'https://auth.identificaciondigital.com.uy/api/v2/openid';
const TOKEN_URL = `${ISSUER}/token`;

const hoisted = vi.hoisted(() => ({
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    APP_URL: 'http://localhost:3001',
    ID_DIGITAL_CLIENT_ID: 'cid',
    ID_DIGITAL_CLIENT_SECRET: 'csecret',
    ID_DIGITAL_REDIRECT_URI: 'https://api.example/auth/id-digital/callback',
    ID_DIGITAL_AUTH_URL: 'https://login.identificaciondigital.com.uy/v2/authorize',
    ID_DIGITAL_TOKEN_URL: 'https://auth.identificaciondigital.com.uy/api/v2/openid/token',
    ID_DIGITAL_ISSUER: 'https://auth.identificaciondigital.com.uy/api/v2/openid',
    ID_DIGITAL_SCOPE: 'openid profile',
    ID_DIGITAL_ACR_VALUES: 'pin',
    ID_DIGITAL_JWKS_URL: '',
    ID_DIGITAL_USERINFO_URL: '',
  },
  state: { current: null as Record<string, unknown> | null },
  user: { current: null as Record<string, unknown> | null },
  conflict: { current: null as Record<string, unknown> | null },
  track: vi.fn(),
  proofCreate: vi.fn(),
}));

vi.mock('../../shared/config/env', () => ({ env: hoisted.env }));
vi.mock('../audit/service', () => ({ auditService: { track: hoisted.track } }));
vi.mock('../../database/models', () => ({
  IdDigitalOAuthStateModel: {
    findOneAndDelete: () => ({ lean: async () => hoisted.state.current }),
  },
  IdDigitalProofModel: { create: hoisted.proofCreate },
  UserModel: {
    findOne: () => ({ select: () => ({ lean: async () => hoisted.conflict.current }) }),
    findById: () => ({ exec: async () => hoisted.user.current }),
  },
}));

import { idDigitalJwksCache } from '../../infrastructure/id-digital/jwks';
import { IdDigitalService } from './id-digital.service';

const key = generateRsaKey('abitab-kid');
const userId = new Types.ObjectId().toHexString();
const now = () => Math.floor(Date.now() / 1000);

function idToken(extra: Record<string, unknown> = {}): string {
  return signJwt(
    {
      acr: 'pin',
      amr: null,
      aud: 'cid',
      exp: now() + 300,
      iat: now(),
      iss: ISSUER,
      sub: 'sub-abitab-1',
      first_name: 'Ana',
      ...extra,
    },
    key,
  );
}

const userInfoBody = {
  sub: 'sub-abitab-1',
  acr: 'pin',
  amr: null,
  document: { document_country: 'UY', document_number: '12345678', document_type: 'CI' },
  registration_level: 2,
  registration_level_description: 'Presencial',
  validation_methods: [{ name: 'presencial', last_validation_date: '2026-01-02T00:00:00Z' }],
  phone: '+59899000000',
  birth_date: '1990-01-01',
};

function installFetch(options: {
  token?: Record<string, unknown>;
  userinfo?: { status: number; body: unknown } | 'throw';
}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === TOKEN_URL) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'at-1',
          token_type: 'Bearer',
          expires_in: 300,
          refresh_token: 'rt',
          id_token: idToken(),
          ...options.token,
        }),
      };
    }
    if (url === `${ISSUER}/jwks`) {
      return { ok: true, status: 200, json: async () => ({ keys: [key.jwk] }) };
    }
    if (url === `${ISSUER}/userinfo`) {
      if (options.userinfo === 'throw') throw new Error('ECONNRESET');
      const ui = options.userinfo ?? { status: 200, body: userInfoBody };
      return { ok: ui.status < 400, status: ui.status, json: async () => ui.body };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function makeUser(extra: Record<string, unknown> = {}) {
  const user: Record<string, unknown> = {
    _id: userId,
    idDigital: undefined,
    documentNumber: undefined,
    save: vi.fn(async () => user),
    ...extra,
  };
  return user;
}

const reasons = () =>
  hoisted.track.mock.calls.map(
    (c) => (c[0] as { metadata?: { reason?: string } }).metadata?.reason,
  );

describe('IdDigitalService.handleCallback', () => {
  beforeEach(() => {
    idDigitalJwksCache.clear();
    hoisted.track.mockReset();
    hoisted.proofCreate.mockReset();
    hoisted.conflict.current = null;
    hoisted.state.current = {
      state: 'st',
      user: new Types.ObjectId(userId),
      purpose: 'agent_onboarding',
      nonce: 'nonce-enviado',
      expiresAt: new Date(Date.now() + 60_000),
    };
  });
  afterEach(() => vi.unstubAllGlobals());

  it('onboarding OK aunque el id_token no traiga nonce; guarda CI y datos del userinfo', async () => {
    installFetch({});
    const user = makeUser();
    hoisted.user.current = user;

    const { redirectUrl } = await new IdDigitalService().handleCallback({
      code: 'c',
      state: 'st',
    });

    expect(redirectUrl).toBe('http://localhost:3001/agente?idDigital=ok');
    expect(user.save).toHaveBeenCalledOnce();
    expect(user.documentNumber).toBe('12345678');
    const idd = user.idDigital as Record<string, unknown>;
    expect(idd.sub).toBe('sub-abitab-1');
    expect(idd.lastAcr).toBe('pin');
    expect(idd.lastAmr).toBeUndefined();
    expect(idd.lastMethods).toEqual(['pin']);
    expect(idd.document).toEqual({ number: '12345678', type: 'CI', country: 'UY' });
    expect(idd.registrationLevel).toBe(2);
    expect(idd.registrationLevelDescription).toBe('Presencial');
    expect(idd.validationMethods).toEqual([
      { name: 'presencial', lastValidationDate: new Date('2026-01-02T00:00:00Z') },
    ]);
    expect(idd.documentMismatch).toBe(false);
    expect(idd.onboardingVerifiedAt).toBeInstanceOf(Date);
    expect(idd).not.toHaveProperty('phone');
    const verified = hoisted.track.mock.calls.at(-1)?.[0] as {
      action: string;
      metadata: Record<string, unknown>;
    };
    expect(verified.action).toBe('ID_DIGITAL_VERIFIED');
    expect(verified.metadata.method).toEqual(['pin']);
    expect(verified.metadata.userInfo).toBe('ok');
  });

  it('rechaza id_token con nonce distinto', async () => {
    installFetch({ token: { id_token: idToken({ nonce: 'otro' }) } });
    const user = makeUser();
    hoisted.user.current = user;
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('reason=token_nonce');
    expect(user.save).not.toHaveBeenCalled();
  });

  it('rechaza id_token con firma inválida', async () => {
    const forged = generateRsaKey('abitab-kid');
    installFetch({
      token: {
        id_token: signJwt(
          { iss: ISSUER, aud: 'cid', sub: 'sub-abitab-1', exp: now() + 300 },
          forged,
        ),
      },
    });
    hoisted.user.current = makeUser();
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('reason=token_signature');
  });

  it('si userinfo falla no rompe el login y lo audita como advertencia', async () => {
    installFetch({ userinfo: { status: 500, body: {} } });
    const user = makeUser({ documentNumber: '1.234.567-8' });
    hoisted.user.current = user;
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('idDigital=ok');
    expect(reasons()).toContain('userinfo_failed');
    expect(user.documentNumber).toBe('1.234.567-8');
    expect((user.idDigital as Record<string, unknown>).document).toBeUndefined();
  });

  it('si userinfo lanza error de red tampoco rompe', async () => {
    installFetch({ userinfo: 'throw' });
    hoisted.user.current = makeUser();
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('idDigital=ok');
    expect(reasons()).toContain('userinfo_failed');
  });

  it('descarta userinfo si el sub no coincide', async () => {
    installFetch({ userinfo: { status: 200, body: { ...userInfoBody, sub: 'otro' } } });
    const user = makeUser();
    hoisted.user.current = user;
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('idDigital=ok');
    expect(reasons()).toContain('userinfo_sub_mismatch');
    expect(user.documentNumber).toBeUndefined();
  });

  it('documento coincidente con formato distinto (puntos/guion) no marca mismatch', async () => {
    installFetch({});
    const user = makeUser({ documentNumber: '1.234.567-8' });
    hoisted.user.current = user;
    await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect((user.idDigital as Record<string, unknown>).documentMismatch).toBe(false);
    expect(user.documentNumber).toBe('1.234.567-8');
    expect(reasons()).not.toContain('document_mismatch');
  });

  it('documento distinto: no pisa el perfil, marca mismatch y audita advertencia sin bloquear', async () => {
    installFetch({});
    const user = makeUser({ documentNumber: '87654321' });
    hoisted.user.current = user;
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('idDigital=ok');
    expect(user.documentNumber).toBe('87654321');
    expect((user.idDigital as Record<string, unknown>).documentMismatch).toBe(true);
    const warning = hoisted.track.mock.calls
      .map((c) => c[0] as { metadata: Record<string, unknown> })
      .find((e) => e.metadata.reason === 'document_mismatch');
    expect(warning?.metadata).toMatchObject({
      severity: 'warning',
      blocking: false,
      profileDocument: '*****321',
      idDigitalDocument: '*****678',
    });
  });

  it('accept_job crea proof y redirige', async () => {
    installFetch({});
    hoisted.state.current = { ...hoisted.state.current, purpose: 'accept_job', ref: 'job:ABC' };
    hoisted.user.current = makeUser({ idDigital: { sub: 'sub-abitab-1' } });
    hoisted.proofCreate.mockResolvedValue({ _id: 'proof-1' });
    const { redirectUrl } = await new IdDigitalService().handleCallback({ code: 'c', state: 'st' });
    expect(redirectUrl).toContain('/agente/trabajos');
    expect(redirectUrl).toContain('proofId=proof-1');
  });
});
