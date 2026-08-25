import { MercadoPagoConnectionStatus } from '@confiapp/database';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOneAccount: vi.fn(),
  findOneAndDeleteState: vi.fn(),
  createState: vi.fn(),
  createAccount: vi.fn(),
  updateOneAccount: vi.fn(),
}));

vi.mock('@confiapp/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@confiapp/database')>();
  return {
    ...actual,
    MercadoPagoSellerAccountModel: {
      findOne: mocks.findOneAccount,
      create: mocks.createAccount,
      updateOne: mocks.updateOneAccount,
    },
    MercadoPagoOAuthStateModel: {
      create: mocks.createState,
      findOneAndDelete: mocks.findOneAndDeleteState,
    },
  };
});

vi.mock('../../shared/config/env', () => ({
  env: {
    APP_URL: 'http://localhost:3001',
    MERCADOPAGO_CLIENT_ID: 'client-id',
    MERCADOPAGO_CLIENT_SECRET: 'client-secret',
    MERCADOPAGO_OAUTH_REDIRECT_URI:
      'http://localhost:3000/payments/mercadopago/oauth/callback',
    MERCADOPAGO_TOKEN_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
}));

import { MercadoPagoOAuthService } from './mercadopago-oauth.service';

function lean(value: unknown) {
  return { lean: vi.fn(async () => value) };
}

describe('MercadoPagoOAuthService', () => {
  const userId = new Types.ObjectId().toHexString();
  const otherUserId = new Types.ObjectId().toHexString();

  const oauth = {
    isConfigured: vi.fn(() => true),
    createAuthorizationUrl: vi.fn(({ state }: { state: string }) =>
      `https://auth.mercadopago.com/authorization?state=${state}`,
    ),
    exchangeCode: vi.fn(),
    getUserMe: vi.fn(),
    refreshAccessToken: vi.fn(),
  };

  let service: MercadoPagoOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MercadoPagoOAuthService(oauth as never);
    mocks.createState.mockResolvedValue({});
    mocks.updateOneAccount.mockReturnValue({ catch: () => undefined });
  });

  it('startOAuth guarda state+PKCE y devuelve authorizationUrl', async () => {
    const result = await service.startOAuth(userId);
    expect(mocks.createState).toHaveBeenCalledOnce();
    const created = mocks.createState.mock.calls[0][0];
    expect(created.user).toBe(userId);
    expect(created.codeVerifier).toBeTruthy();
    expect(created.state).toBeTruthy();
    expect(result.authorizationUrl).toContain(created.state);
  });

  it('callback cancelado (access_denied) redirige con reason=cancelled', async () => {
    const { redirectUrl } = await service.handleCallback({
      error: 'access_denied',
    });
    expect(redirectUrl).toContain('mp=error');
    expect(redirectUrl).toContain('reason=cancelled');
    expect(oauth.exchangeCode).not.toHaveBeenCalled();
  });

  it('flujo feliz: exchange + users/me + create account', async () => {
    const stateDoc = {
      state: 'state-1',
      user: userId,
      codeVerifier: 'verifier-1',
      expiresAt: new Date(Date.now() + 60_000),
    };
    mocks.findOneAndDeleteState.mockReturnValue(lean(stateDoc));
    mocks.findOneAccount
      .mockReturnValueOnce(lean(null))
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce({
        sort: vi.fn().mockResolvedValue(null),
      });

    oauth.exchangeCode.mockResolvedValue({
      access_token: 'ACCESS',
      refresh_token: 'REFRESH',
      expires_in: 3600,
      user_id: 12345,
      scope: 'offline_access read',
      token_type: 'bearer',
    });
    oauth.getUserMe.mockResolvedValue({
      id: 12345,
      nickname: 'vendedor_uy',
      email: 'seller@example.com',
    });
    mocks.createAccount.mockResolvedValue({});

    const { redirectUrl } = await service.handleCallback({
      code: 'auth-code',
      state: 'state-1',
    });

    expect(oauth.exchangeCode).toHaveBeenCalledWith({
      code: 'auth-code',
      codeVerifier: 'verifier-1',
    });
    expect(mocks.createAccount).toHaveBeenCalledOnce();
    const created = mocks.createAccount.mock.calls[0][0];
    expect(created.mpUserId).toBe('12345');
    expect(created.publicNickname).toBe('vendedor_uy');
    expect(created.status).toBe(MercadoPagoConnectionStatus.CONNECTED);
    expect(created.accessTokenEnc).not.toContain('ACCESS');
    expect(redirectUrl).toContain('mp=ok');
    expect(redirectUrl).toContain('tab=settings');
  });

  it('duplicate mpUserId de otro usuario → error', async () => {
    mocks.findOneAndDeleteState.mockReturnValue(
      lean({
        state: 'state-2',
        user: userId,
        codeVerifier: 'v',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );
    oauth.exchangeCode.mockResolvedValue({
      access_token: 'ACCESS',
      expires_in: 3600,
      user_id: 99,
      token_type: 'bearer',
    });
    oauth.getUserMe.mockResolvedValue({ id: 99, nickname: 'otro' });
    mocks.findOneAccount.mockReturnValueOnce(lean({ user: otherUserId, mpUserId: '99' }));

    const { redirectUrl } = await service.handleCallback({
      code: 'c',
      state: 'state-2',
    });
    expect(redirectUrl).toContain('reason=mp_account_in_use');
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it('reconnect upsert actualiza tokens de cuenta existente', async () => {
    mocks.findOneAndDeleteState.mockReturnValue(
      lean({
        state: 'state-3',
        user: userId,
        codeVerifier: 'v3',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );
    oauth.exchangeCode.mockResolvedValue({
      access_token: 'ACCESS2',
      refresh_token: 'REFRESH2',
      expires_in: 7200,
      user_id: 55,
      token_type: 'bearer',
    });
    oauth.getUserMe.mockResolvedValue({
      id: 55,
      nickname: 'reconnected',
      email: 'r@example.com',
    });

    const existing = {
      mpUserId: '55',
      publicNickname: 'old',
      email: 'old@example.com',
      accessTokenEnc: 'old-enc',
      refreshTokenEnc: 'old-ref',
      connectedAt: new Date('2025-01-01'),
      status: MercadoPagoConnectionStatus.CONNECTED,
      save: vi.fn(async () => undefined),
    };

    mocks.findOneAccount
      .mockReturnValueOnce(lean(null))
      .mockResolvedValueOnce(existing);

    const { redirectUrl } = await service.handleCallback({
      code: 'c3',
      state: 'state-3',
    });

    expect(existing.save).toHaveBeenCalledOnce();
    expect(existing.publicNickname).toBe('reconnected');
    expect(existing.accessTokenEnc).not.toBe('old-enc');
    expect(existing.status).toBe(MercadoPagoConnectionStatus.CONNECTED);
    expect(redirectUrl).toContain('mp=ok');
  });

  it('getConnection sin cuenta → NOT_CONNECTED', async () => {
    mocks.findOneAccount.mockReturnValue(lean(null));
    const view = await service.getConnection(userId);
    expect(view.status).toBe(MercadoPagoConnectionStatus.NOT_CONNECTED);
    expect(view.connected).toBe(false);
    expect(view.oauthConfigured).toBe(true);
  });
});
