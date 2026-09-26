import { randomBytes } from 'node:crypto';

import { AuditAction, AuditOutcome } from '@confiapp/database';
import { Types } from 'mongoose';

import {
  IdDigitalOAuthStateModel,
  IdDigitalProofModel,
  UserModel,
  type IdDigitalPurpose,
} from '../../database/models';
import { idDigitalClient } from '../../infrastructure/id-digital/id-digital.client';
import {
  IdTokenValidationError,
  parseAndValidateIdToken,
} from '../../infrastructure/id-digital/id-token';
import { env } from '../../shared/config/env';
import { AppError, ValidationError } from '../../shared/errors/app-error';
import { auditService } from '../audit/service';
import { logger } from '../../utils/logger';
import { generateOAuthState } from '../../utils/secret-crypto';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const PROOF_TTL_MS = 5 * 60 * 1000;

export type IdDigitalStartPurpose = IdDigitalPurpose;

function frontRedirect(
  path: string,
  params: Record<string, string>,
): string {
  const url = new URL(path, env.APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function generateNonce(): string {
  return randomBytes(24).toString('base64url');
}

export class IdDigitalService {
  isConfigured(): boolean {
    return idDigitalClient.isConfigured();
  }

  async getStatus(userId: string): Promise<{
    configured: boolean;
    linked: boolean;
    onboardingVerified: boolean;
    onboardingVerifiedAt?: string;
    lastVerifiedAt?: string;
    sub?: string;
  }> {
    const configured = this.isConfigured();
    const user = await UserModel.findById(userId).select('idDigital').lean();
    const idDigital = user?.idDigital;
    return {
      configured,
      linked: Boolean(idDigital?.sub),
      onboardingVerified: Boolean(idDigital?.onboardingVerifiedAt),
      onboardingVerifiedAt: idDigital?.onboardingVerifiedAt?.toISOString(),
      lastVerifiedAt: idDigital?.lastVerifiedAt?.toISOString(),
      sub: idDigital?.sub,
    };
  }

  async start(input: {
    userId: string;
    purpose: IdDigitalStartPurpose;
    ref?: string;
  }): Promise<{ authorizationUrl: string; configured: true }> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Identidad Digital Abitab no está configurada',
        undefined,
        'ID_DIGITAL_NOT_CONFIGURED',
      );
    }

    if (input.purpose === 'accept_job') {
      const ref = input.ref?.trim();
      if (!ref || (!ref.startsWith('job:') && !ref.startsWith('offer:'))) {
        throw new ValidationError(
          'ref debe ser job:{CODE} u offer:{notificationId}',
        );
      }
    }

    const state = generateOAuthState();
    const nonce = generateNonce();
    await IdDigitalOAuthStateModel.create({
      state,
      user: new Types.ObjectId(input.userId),
      purpose: input.purpose,
      ref: input.purpose === 'accept_job' ? input.ref!.trim() : undefined,
      nonce,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    });

    const authorizationUrl = idDigitalClient.createAuthorizationUrl({ state, nonce });
    return { authorizationUrl, configured: true };
  }

  async handleCallback(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): Promise<{ redirectUrl: string }> {
    if (query.error) {
      logger.info('id-digital oauth cancelled or denied', {
        error: query.error,
        description: query.error_description,
      });
      return {
        redirectUrl: frontRedirect('/agente', {
          idDigital: 'error',
          reason: query.error === 'access_denied' ? 'cancelled' : 'oauth_denied',
        }),
      };
    }

    if (!query.code || !query.state) {
      return {
        redirectUrl: frontRedirect('/agente', {
          idDigital: 'error',
          reason: 'missing_params',
        }),
      };
    }

    const oauthState = await IdDigitalOAuthStateModel.findOneAndDelete({
      state: query.state,
    }).lean();

    if (!oauthState) {
      return {
        redirectUrl: frontRedirect('/agente', {
          idDigital: 'error',
          reason: 'invalid_state',
        }),
      };
    }
    if (oauthState.expiresAt.getTime() < Date.now()) {
      return {
        redirectUrl: frontRedirect('/agente', {
          idDigital: 'error',
          reason: 'expired_state',
        }),
      };
    }

    const userId = String(oauthState.user);

    try {
      const tokens = await idDigitalClient.exchangeCode(query.code);
      if (!tokens.id_token) {
        throw new AppError(
          502,
          'El proveedor no devolvió id_token',
          undefined,
          'ID_DIGITAL_MISSING_ID_TOKEN',
        );
      }

      const claims = parseAndValidateIdToken(tokens.id_token, {
        issuer: env.ID_DIGITAL_ISSUER,
        clientId: env.ID_DIGITAL_CLIENT_ID,
        nonce: oauthState.nonce,
      });

      const conflict = await UserModel.findOne({
        'idDigital.sub': claims.sub,
        _id: { $ne: new Types.ObjectId(userId) },
        deletedAt: null,
      })
        .select('_id')
        .lean();

      if (conflict) {
        auditService.track({
          actor: userId,
          action: AuditAction.ID_DIGITAL_FAILED,
          entityType: 'User',
          entityId: userId,
          outcome: AuditOutcome.FAILURE,
          metadata: {
            purpose: oauthState.purpose,
            reason: 'sub_conflict',
          },
        });
        return {
          redirectUrl: this.redirectForPurpose(oauthState.purpose, oauthState.ref, {
            idDigital: 'error',
            reason: 'sub_conflict',
          }),
        };
      }

      const now = new Date();
      const user = await UserModel.findById(userId).exec();
      if (!user) {
        return {
          redirectUrl: frontRedirect('/agente', {
            idDigital: 'error',
            reason: 'user_not_found',
          }),
        };
      }

      const existingSub = user.idDigital?.sub;
      if (existingSub && existingSub !== claims.sub) {
        auditService.track({
          actor: userId,
          action: AuditAction.ID_DIGITAL_FAILED,
          entityType: 'User',
          entityId: userId,
          outcome: AuditOutcome.FAILURE,
          metadata: {
            purpose: oauthState.purpose,
            reason: 'sub_mismatch',
          },
        });
        return {
          redirectUrl: this.redirectForPurpose(oauthState.purpose, oauthState.ref, {
            idDigital: 'error',
            reason: 'sub_mismatch',
          }),
        };
      }

      user.idDigital = {
        ...user.idDigital,
        sub: claims.sub,
        linkedAt: user.idDigital?.linkedAt ?? now,
        lastVerifiedAt: now,
        lastAcr: claims.acr,
        lastAmr: claims.amr,
        onboardingVerifiedAt:
          oauthState.purpose === 'agent_onboarding'
            ? now
            : user.idDigital?.onboardingVerifiedAt,
      };
      await user.save();

      auditService.track({
        actor: userId,
        action: AuditAction.ID_DIGITAL_VERIFIED,
        entityType: 'User',
        entityId: userId,
        outcome: AuditOutcome.SUCCESS,
        metadata: {
          purpose: oauthState.purpose,
          ref: oauthState.ref,
          acr: claims.acr,
          amr: claims.amr,
        },
      });

      if (oauthState.purpose === 'agent_onboarding') {
        return {
          redirectUrl: frontRedirect('/agente', { idDigital: 'ok' }),
        };
      }

      const proof = await IdDigitalProofModel.create({
        user: new Types.ObjectId(userId),
        purpose: 'accept_job',
        ref: oauthState.ref!,
        sub: claims.sub,
        expiresAt: new Date(Date.now() + PROOF_TTL_MS),
      });

      return {
        redirectUrl: this.redirectForPurpose('accept_job', oauthState.ref, {
          idDigital: 'ok',
          proofId: String(proof._id),
          ref: oauthState.ref!,
        }),
      };
    } catch (error) {
      const reason =
        error instanceof IdTokenValidationError
          ? `token_${error.code.toLowerCase()}`
          : error instanceof AppError
            ? error.code?.toLowerCase() ?? 'exchange_failed'
            : 'exchange_failed';

      logger.warn('id-digital callback failed', {
        userId,
        reason,
        message: error instanceof Error ? error.message : String(error),
      });

      auditService.track({
        actor: userId,
        action: AuditAction.ID_DIGITAL_FAILED,
        entityType: 'User',
        entityId: userId,
        outcome: AuditOutcome.FAILURE,
        metadata: { purpose: oauthState.purpose, reason },
      });

      return {
        redirectUrl: this.redirectForPurpose(oauthState.purpose, oauthState.ref, {
          idDigital: 'error',
          reason,
        }),
      };
    }
  }

  /**
   * Consume un proof one-shot para aceptar trabajo.
   * Lanza ForbiddenError si falta / expiró / no coincide.
   */
  async consumeAcceptJobProof(input: {
    userId: string;
    proofId: string | undefined;
    expectedRef: string;
  }): Promise<void> {
    if (!this.isConfigured()) {
      // Si no está configurado en este entorno, no exigir (dev local sin credenciales).
      // En Railway con credenciales sí se exige.
      return;
    }

    const proofId = input.proofId?.trim();
    if (!proofId || !Types.ObjectId.isValid(proofId)) {
      throw new AppError(
        403,
        'Debés verificar tu identidad con Identidad Digital Abitab para aceptar el trabajo.',
        undefined,
        'ID_DIGITAL_PROOF_REQUIRED',
      );
    }

    const proof = await IdDigitalProofModel.findOneAndUpdate(
      {
        _id: proofId,
        user: input.userId,
        purpose: 'accept_job',
        ref: input.expectedRef,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() } },
      { new: true },
    ).exec();

    if (!proof) {
      throw new AppError(
        403,
        'La verificación de Identidad Digital expiró o no es válida. Volvé a autenticarte.',
        undefined,
        'ID_DIGITAL_PROOF_INVALID',
      );
    }
  }

  assertOnboardingVerified(user: {
    idDigital?: { onboardingVerifiedAt?: Date | null } | null;
  }): void {
    if (!this.isConfigured()) {
      return;
    }
    if (!user.idDigital?.onboardingVerifiedAt) {
      throw new AppError(
        403,
        'Debés verificar tu identidad con Identidad Digital Abitab antes de convertirte en agente.',
        undefined,
        'ID_DIGITAL_REQUIRED',
      );
    }
  }

  private redirectForPurpose(
    purpose: IdDigitalPurpose,
    ref: string | undefined,
    params: Record<string, string>,
  ): string {
    if (purpose === 'agent_onboarding') {
      return frontRedirect('/agente', params);
    }
    if (ref?.startsWith('offer:')) {
      return frontRedirect('/notificaciones', params);
    }
    return frontRedirect('/agente/trabajos', params);
  }
}

export const idDigitalService = new IdDigitalService();
