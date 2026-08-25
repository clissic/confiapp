import {
  MercadoPagoConnectionStatus,
  MercadoPagoOAuthStateModel,
  MercadoPagoSellerAccountModel,
} from '@confiapp/database';

import {
  mercadoPagoOAuthClient,
  type MercadoPagoOAuthClient,
} from '../../infrastructure/payments/mercadopago-oauth.client';
import { env } from '../../shared/config/env';
import { AppError } from '../../shared/errors/app-error';
import { logger } from '../../utils/logger';
import {
  decryptSecret,
  encryptSecret,
  generateOAuthState,
  generatePkcePair,
} from '../../utils/secret-crypto';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
/** Renovar si faltan menos de 24h para vencer. */
const REFRESH_SKEW_MS = 24 * 60 * 60 * 1000;

export interface MercadoPagoConnectionView {
  status: MercadoPagoConnectionStatus;
  connected: boolean;
  oauthConfigured: boolean;
  mpUserId?: string;
  publicNickname?: string;
  email?: string;
  connectedAt?: string;
  lastError?: string;
}

function frontRedirect(mp: 'ok' | 'error', reason?: string): string {
  const url = new URL('/perfil', env.APP_URL);
  url.searchParams.set('tab', 'settings');
  url.searchParams.set('mp', mp);
  if (reason) url.searchParams.set('reason', reason);
  return url.toString();
}

function requireEncryptionKey(): string {
  const key = env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new AppError(
      503,
      'Cifrado de tokens Mercado Pago no configurado',
      undefined,
      'MP_ENCRYPTION_NOT_CONFIGURED',
    );
  }
  return key;
}

export class MercadoPagoOAuthService {
  constructor(private readonly oauth: MercadoPagoOAuthClient = mercadoPagoOAuthClient) {}

  async getConnection(userId: string): Promise<MercadoPagoConnectionView> {
    const oauthConfigured = this.oauth.isConfigured();
    const account = await MercadoPagoSellerAccountModel.findOne({
      user: userId,
      deletedAt: null,
    }).lean();

    if (!account) {
      return {
        status: MercadoPagoConnectionStatus.NOT_CONNECTED,
        connected: false,
        oauthConfigured,
      };
    }

    return {
      status: account.status,
      connected: account.status === MercadoPagoConnectionStatus.CONNECTED,
      oauthConfigured,
      mpUserId: account.mpUserId,
      publicNickname: account.publicNickname,
      email: account.email,
      connectedAt: account.connectedAt?.toISOString(),
      lastError: account.lastError,
    };
  }

  async startOAuth(userId: string): Promise<{ authorizationUrl: string }> {
    if (!this.oauth.isConfigured()) {
      throw new AppError(
        503,
        'Vinculación Mercado Pago no configurada',
        undefined,
        'MP_OAUTH_NOT_CONFIGURED',
      );
    }
    requireEncryptionKey();

    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = generateOAuthState();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await MercadoPagoOAuthStateModel.create({
      state,
      user: userId,
      codeVerifier,
      expiresAt,
    });

    const authorizationUrl = this.oauth.createAuthorizationUrl({ state, codeChallenge });
    return { authorizationUrl };
  }

  /**
   * Callback público: valida state, canjea code, upsert cuenta.
   * Devuelve URL absoluta de redirect al front (nunca tokens).
   */
  async handleCallback(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): Promise<{ redirectUrl: string }> {
    if (query.error) {
      const reason =
        query.error === 'access_denied' ? 'cancelled' : 'oauth_denied';
      logger.info('mercadopago oauth cancelled or denied', { error: query.error });
      return { redirectUrl: frontRedirect('error', reason) };
    }

    const code = query.code?.trim();
    const state = query.state?.trim();
    if (!code || !state) {
      return { redirectUrl: frontRedirect('error', 'missing_params') };
    }

    const oauthState = await MercadoPagoOAuthStateModel.findOneAndDelete({ state }).lean();
    if (!oauthState) {
      return { redirectUrl: frontRedirect('error', 'invalid_state') };
    }
    if (oauthState.expiresAt.getTime() < Date.now()) {
      return { redirectUrl: frontRedirect('error', 'expired_state') };
    }

    const userId = String(oauthState.user);
    const encKey = requireEncryptionKey();

    try {
      const tokens = await this.oauth.exchangeCode({
        code,
        codeVerifier: oauthState.codeVerifier,
      });
      const me = await this.oauth.getUserMe(tokens.access_token);
      const mpUserId = String(me.id ?? tokens.user_id);

      const other = await MercadoPagoSellerAccountModel.findOne({
        mpUserId,
        deletedAt: null,
        user: { $ne: userId },
      }).lean();
      if (other) {
        return { redirectUrl: frontRedirect('error', 'mp_account_in_use') };
      }

      const accessTokenEnc = encryptSecret(tokens.access_token, encKey);
      const refreshTokenEnc = tokens.refresh_token
        ? encryptSecret(tokens.refresh_token, encKey)
        : undefined;
      const tokenExpiresAt =
        typeof tokens.expires_in === 'number'
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined;

      const existing = await MercadoPagoSellerAccountModel.findOne({
        user: userId,
        deletedAt: null,
      });

      if (existing) {
        existing.mpUserId = mpUserId;
        existing.publicNickname = me.nickname ?? existing.publicNickname;
        existing.email = me.email ?? existing.email;
        existing.accessTokenEnc = accessTokenEnc;
        existing.refreshTokenEnc = refreshTokenEnc;
        existing.tokenExpiresAt = tokenExpiresAt;
        existing.scope = tokens.scope;
        existing.status = MercadoPagoConnectionStatus.CONNECTED;
        existing.connectedAt = existing.connectedAt ?? new Date();
        existing.lastError = undefined;
        await existing.save();
      } else {
        // Soft-deleted previa: reactivar o crear
        const softDeleted = await MercadoPagoSellerAccountModel.findOne({
          user: userId,
          deletedAt: { $ne: null },
        }).sort({ updatedAt: -1 });

        if (softDeleted) {
          softDeleted.deletedAt = null;
          softDeleted.mpUserId = mpUserId;
          softDeleted.publicNickname = me.nickname;
          softDeleted.email = me.email;
          softDeleted.accessTokenEnc = accessTokenEnc;
          softDeleted.refreshTokenEnc = refreshTokenEnc;
          softDeleted.tokenExpiresAt = tokenExpiresAt;
          softDeleted.scope = tokens.scope;
          softDeleted.status = MercadoPagoConnectionStatus.CONNECTED;
          softDeleted.connectedAt = new Date();
          softDeleted.lastError = undefined;
          await softDeleted.save();
        } else {
          await MercadoPagoSellerAccountModel.create({
            user: userId,
            mpUserId,
            publicNickname: me.nickname,
            email: me.email,
            accessTokenEnc,
            refreshTokenEnc,
            tokenExpiresAt,
            scope: tokens.scope,
            status: MercadoPagoConnectionStatus.CONNECTED,
            connectedAt: new Date(),
          });
        }
      }

      return { redirectUrl: frontRedirect('ok') };
    } catch (err) {
      logger.warn('mercadopago oauth callback failed', {
        userId,
        message: err instanceof Error ? err.message : 'unknown',
      });
      await MercadoPagoSellerAccountModel.updateOne(
        { user: userId, deletedAt: null },
        {
          $set: {
            status: MercadoPagoConnectionStatus.ERROR,
            lastError: 'oauth_exchange_failed',
          },
        },
      ).catch(() => undefined);
      return { redirectUrl: frontRedirect('error', 'exchange_failed') };
    }
  }

  async disconnect(userId: string): Promise<{ ok: true }> {
    const account = await MercadoPagoSellerAccountModel.findOne({
      user: userId,
      deletedAt: null,
    });
    if (!account) {
      return { ok: true };
    }
    account.deletedAt = new Date();
    account.status = MercadoPagoConnectionStatus.NOT_CONNECTED;
    account.accessTokenEnc = encryptSecret('revoked', requireEncryptionKey());
    account.refreshTokenEnc = undefined;
    account.tokenExpiresAt = undefined;
    account.lastError = undefined;
    await account.save();
    return { ok: true };
  }

  /**
   * Helper interno para uso futuro (split): token válido del seller, con refresh.
   */
  async getValidSellerAccessToken(userId: string): Promise<string | null> {
    const account = await MercadoPagoSellerAccountModel.findOne({
      user: userId,
      deletedAt: null,
      status: MercadoPagoConnectionStatus.CONNECTED,
    });
    if (!account) return null;

    const encKey = requireEncryptionKey();
    const needsRefresh =
      !account.tokenExpiresAt ||
      account.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

    if (!needsRefresh) {
      return decryptSecret(account.accessTokenEnc, encKey);
    }

    if (!account.refreshTokenEnc) {
      account.status = MercadoPagoConnectionStatus.EXPIRED;
      await account.save();
      return null;
    }

    try {
      const refreshToken = decryptSecret(account.refreshTokenEnc, encKey);
      const tokens = await this.oauth.refreshAccessToken(refreshToken);
      account.accessTokenEnc = encryptSecret(tokens.access_token, encKey);
      if (tokens.refresh_token) {
        account.refreshTokenEnc = encryptSecret(tokens.refresh_token, encKey);
      }
      account.tokenExpiresAt =
        typeof tokens.expires_in === 'number'
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : account.tokenExpiresAt;
      account.status = MercadoPagoConnectionStatus.CONNECTED;
      account.lastError = undefined;
      await account.save();
      return tokens.access_token;
    } catch (err) {
      logger.warn('mercadopago seller token refresh failed', {
        userId,
        message: err instanceof Error ? err.message : 'unknown',
      });
      account.status = MercadoPagoConnectionStatus.EXPIRED;
      account.lastError = 'refresh_failed';
      await account.save();
      return null;
    }
  }
}
