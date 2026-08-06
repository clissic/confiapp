import { randomUUID } from 'node:crypto';

import { PlatformRole, UserStatus, type IUser } from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';
import type { CookieOptions, Request, Response } from 'express';

import { emailSender } from '../../infrastructure/email/email.sender';
import {
  getRefreshExpiresAt,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../infrastructure/security/jwt';
import { env } from '../../shared/config/env';
import {
  AppError,
  ForbiddenError,
  UnauthorizedError,
} from '../../shared/errors/app-error';
import { generateOpaqueToken, hashToken } from '../../utils/crypto-tokens';
import { logger } from '../../utils/logger';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  AuditAction,
  AuditOutcome,
  auditService,
} from '../audit';

import type { AuthSessionDto, AuthUserDto, MessageDto } from './dto';
import { AuthRepository, type UserDocument } from './repository';

const REFRESH_COOKIE = 'refreshToken';
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function toAuthUser(user: HydratedDocument<IUser> | UserDocument): AuthUserDto {
  const identityStatus = user.kyc?.status ?? user.verification?.identity?.status;
  return {
    id: user.id as string,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatar: user.avatar,
    status: user.status,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
    identityVerified: identityStatus === 'VERIFIED',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function isLocked(user: UserDocument): boolean {
  return Boolean(user.lockUntil && user.lockUntil.getTime() > Date.now());
}

export class AuthService {
  constructor(private readonly repository = new AuthRepository()) {}

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: getRefreshExpiresAt().getTime() - Date.now(),
    };
  }

  setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, this.refreshCookieOptions());
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
    });
  }

  private extractRefreshToken(req: Request): string | undefined {
    const fromCookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    return fromCookie || fromBody;
  }

  private async issueSession(
    user: UserDocument,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthSessionDto> {
    const jti = randomUUID();
    const accessToken = signAccessToken({
      sub: user.id as string,
      email: user.email,
      role: user.role ?? PlatformRole.USER,
    });
    const refreshToken = signRefreshToken({
      sub: user.id as string,
      jti,
    });

    await this.repository.createRefreshToken({
      userId: user.id as string,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshExpiresAt(),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return {
      user: toAuthUser(user),
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
    };
  }

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<{ user: AuthUserDto; message: string; needsVerification: true }> {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'Email already registered', undefined, 'EMAIL_TAKEN');
    }

    const verificationToken = generateOpaqueToken();
    const passwordHash = await hashPassword(input.password);

    const user = await this.repository.createUser({
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpires: new Date(Date.now() + VERIFY_TTL_MS),
    });

    await this.sendVerificationEmail(user.email, verificationToken);

    auditService.track({
      actor: String(user._id),
      actorRole: user.role,
      action: AuditAction.REGISTER,
      entityType: 'User',
      entityId: String(user._id),
      outcome: AuditOutcome.SUCCESS,
      metadata: { email: user.email },
    });

    return {
      user: toAuthUser(user),
      message: 'Cuenta creada. Revisá tu email para confirmarla.',
      needsVerification: true as const,
    };
  }

  async login(
    email: string,
    password: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthSessionDto> {
    const user = await this.repository.findByEmail(email);

    // Respuesta genérica (anti user enumeration).
    const invalid = () =>
      new UnauthorizedError('Invalid email or password');

    if (!user?.passwordHash) {
      throw invalid();
    }

    if (user.status === UserStatus.SUSPENDED) {
      auditService.track({
        actor: String(user._id),
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: String(user._id),
        outcome: AuditOutcome.FAILURE,
        metadata: { reason: 'suspended' },
        ...meta,
      });
      throw new ForbiddenError('Account suspended');
    }

    if (isLocked(user)) {
      auditService.track({
        actor: String(user._id),
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: String(user._id),
        outcome: AuditOutcome.FAILURE,
        metadata: { reason: 'locked' },
        ...meta,
      });
      throw new ForbiddenError('Account temporarily locked. Try again later.');
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= env.MAX_FAILED_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60_000);
        user.failedLoginAttempts = 0;
        logger.warn('account.locked', { userId: user.id, email: user.email });
      }
      await this.repository.saveUser(user);
      auditService.track({
        actor: String(user._id),
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: String(user._id),
        outcome: AuditOutcome.FAILURE,
        metadata: { reason: 'invalid_password', locked: Boolean(user.lockUntil) },
        ...meta,
      });
      throw invalid();
    }

    if (!user.emailVerifiedAt) {
      auditService.track({
        actor: String(user._id),
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: String(user._id),
        outcome: AuditOutcome.FAILURE,
        metadata: { reason: 'email_not_verified' },
        ...meta,
      });
      throw new AppError(
        403,
        'Debés verificar tu email antes de ingresar. Revisá tu bandeja de entrada.',
        { email: user.email },
        'EMAIL_NOT_VERIFIED',
      );
    }

    user.failedLoginAttempts = 0;
    user.set('lockUntil', undefined);
    user.lastLoginAt = new Date();
    await this.repository.saveUser(user);

    auditService.track({
      actor: String(user._id),
      actorRole: user.role,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: String(user._id),
      outcome: AuditOutcome.SUCCESS,
      ...meta,
    });

    return this.issueSession(user, meta);
  }

  async refresh(
    req: Request,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthSessionDto> {
    const raw = this.extractRefreshToken(req);
    if (!raw) {
      throw new UnauthorizedError('Refresh token required');
    }

    const payload = verifyRefreshToken(raw);
    const hash = hashToken(raw);
    const stored = await this.repository.findRefreshTokenByHash(hash);

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      // Posible reuso de token robado → revocar familia del usuario.
      if (stored?.user) {
        await this.repository.revokeAllRefreshTokensForUser(String(stored.user));
      }
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (String(stored.user) !== payload.sub) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.repository.findById(payload.sub);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const nextSession = await this.issueSession(user, meta);
    await this.repository.revokeRefreshToken(stored, hashToken(nextSession.tokens.refreshToken));

    return nextSession;
  }

  async logout(req: Request, allDevices = false): Promise<MessageDto> {
    const raw = this.extractRefreshToken(req);
    const userId = req.user?.id;

    if (allDevices && req.user) {
      await this.repository.revokeAllRefreshTokensForUser(req.user.id);
      auditService.track({
        actor: req.user.id,
        action: AuditAction.LOGOUT,
        entityType: 'User',
        entityId: req.user.id,
        outcome: AuditOutcome.SUCCESS,
        metadata: { allDevices: true },
      });
      return { message: 'Logged out from all devices' };
    }

    if (raw) {
      const stored = await this.repository.findRefreshTokenByHash(hashToken(raw));
      if (stored && !stored.revokedAt) {
        await this.repository.revokeRefreshToken(stored);
        const uid = String(stored.user);
        auditService.track({
          actor: uid,
          action: AuditAction.LOGOUT,
          entityType: 'User',
          entityId: uid,
          outcome: AuditOutcome.SUCCESS,
          metadata: { allDevices: false },
        });
      }
    } else if (userId) {
      auditService.track({
        actor: userId,
        action: AuditAction.LOGOUT,
        entityType: 'User',
        entityId: userId,
        outcome: AuditOutcome.SUCCESS,
      });
    }

    return { message: 'Logged out' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<MessageDto> {
    const user = await this.repository.findById(userId);
    if (!user?.passwordHash) {
      throw new UnauthorizedError('User not found');
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw new AppError(400, 'New password must be different', undefined, 'PASSWORD_REUSE');
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await this.repository.saveUser(user);
    await this.repository.revokeAllRefreshTokensForUser(userId);

    auditService.track({
      actor: userId,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: 'User',
      entityId: userId,
      outcome: AuditOutcome.SUCCESS,
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string): Promise<MessageDto> {
    const generic = {
      message: 'If an account exists for that email, a reset link was sent.',
    };

    const user = await this.repository.findByEmail(email);
    if (!user) {
      return generic;
    }

    const token = generateOpaqueToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
    await this.repository.saveUser(user);

    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
    await emailSender.send({
      to: user.email,
      subject: 'ConfiApp — Password reset',
      text: `Reset your password (expires in 1 hour): ${resetUrl}`,
      html: `<p>Reset your password (expires in 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    return generic;
  }

  async resetPassword(token: string, newPassword: string): Promise<MessageDto> {
    const user = await this.repository.findByPasswordResetHash(hashToken(token));
    if (!user) {
      throw new AppError(400, 'Invalid or expired reset token', undefined, 'INVALID_TOKEN');
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await this.repository.saveUser(user);
    await this.repository.revokeAllRefreshTokensForUser(user.id as string);

    auditService.track({
      actor: String(user._id),
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: String(user._id),
      outcome: AuditOutcome.SUCCESS,
    });

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(token: string): Promise<MessageDto> {
    const user = await this.repository.findByEmailVerificationHash(hashToken(token));
    if (!user) {
      throw new AppError(400, 'Invalid or expired verification token', undefined, 'INVALID_TOKEN');
    }

    const verifiedAt = new Date();
    user.emailVerifiedAt = verifiedAt;
    user.set('emailVerificationTokenHash', undefined);
    user.set('emailVerificationExpires', undefined);
    if (user.verification?.email) {
      user.verification.email.verified = true;
      user.verification.email.verifiedAt = verifiedAt;
    } else {
      user.set('verification.email', { verified: true, verifiedAt });
    }
    await this.repository.saveUser(user);

    auditService.track({
      actor: String(user._id),
      action: AuditAction.EMAIL_VERIFIED,
      entityType: 'User',
      entityId: String(user._id),
      outcome: AuditOutcome.SUCCESS,
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string): Promise<MessageDto> {
    const generic = {
      message: 'If an unverified account exists for that email, a link was sent.',
    };

    const user = await this.repository.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return generic;
    }

    const token = generateOpaqueToken();
    user.emailVerificationTokenHash = hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + VERIFY_TTL_MS);
    await this.repository.saveUser(user);
    await this.sendVerificationEmail(user.email, token);

    return generic;
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return toAuthUser(user);
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${env.APP_URL}/verificar-email?token=${encodeURIComponent(token)}`;
    await emailSender.send({
      to: email,
      subject: 'ConfiApp — Confirmá tu email',
      text: [
        'Hola,',
        '',
        'Gracias por registrarte en ConfiApp. Para activar tu cuenta, confirmá tu email:',
        verifyUrl,
        '',
        'El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;line-height:1.5;color:#0f172a">
          <h2 style="color:#01285d;margin:0 0 12px">Confirmá tu email</h2>
          <p>Gracias por registrarte en <strong>ConfiApp</strong>. Tocá el botón para activar tu cuenta:</p>
          <p style="margin:24px 0">
            <a href="${verifyUrl}"
               style="display:inline-block;background:#01285d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
              Confirmar email
            </a>
          </p>
          <p style="font-size:14px;color:#64748b">O abrí este enlace:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p style="font-size:13px;color:#94a3b8">El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.</p>
        </div>
      `,
    });
  }
}
