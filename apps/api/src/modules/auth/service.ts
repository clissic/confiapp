import { randomUUID } from 'node:crypto';

import { PlatformRole, UserStatus, NotificationChannel, NotificationType, type IUser } from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';
import type { CookieOptions, Request, Response } from 'express';

import {
  buildBrandedEmail,
  emailParagraphs,
} from '../../infrastructure/email/email-layout';
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
import { notificationsService } from '../notifications/service';

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
    documentNumber: string;
    phone: string;
  }): Promise<{ user: AuthUserDto; message: string; needsVerification: true }> {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'Ese email ya está registrado', undefined, 'EMAIL_TAKEN');
    }

    const verificationToken = generateOpaqueToken();
    const passwordHash = await hashPassword(input.password);

    const user = await this.repository.createUser({
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName.trim().replace(/\s+/g, ' '),
      phone: input.phone.trim(),
      documentNumber: input.documentNumber.trim(),
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpires: new Date(Date.now() + VERIFY_TTL_MS),
    });

    // Diferir el SMTP al próximo tick para no retrasar la respuesta HTTP
    // (buildBrandedEmail lee disco de forma sync antes del primer await).
    setImmediate(() => {
      void this.sendVerificationEmail(user.email, verificationToken).catch((error) => {
        logger.error('auth.register_email_failed', {
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

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
      new UnauthorizedError('Email o contraseña incorrectos');

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
      throw new ForbiddenError('Cuenta suspendida');
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
      throw new ForbiddenError('Cuenta bloqueada temporalmente. Probá de nuevo más tarde.');
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
      throw new UnauthorizedError('Se requiere token de sesión');
    }

    const payload = verifyRefreshToken(raw);
    const hash = hashToken(raw);
    const stored = await this.repository.findRefreshTokenByHash(hash);

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      // Posible reuso de token robado → revocar familia del usuario.
      if (stored?.user) {
        await this.repository.revokeAllRefreshTokensForUser(String(stored.user));
      }
      throw new UnauthorizedError('Sesión inválida o expirada');
    }

    if (String(stored.user) !== payload.sub) {
      throw new UnauthorizedError('Sesión inválida o expirada');
    }

    const user = await this.repository.findById(payload.sub);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedError('Sesión inválida o expirada');
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
      return { message: 'Sesión cerrada en todos los dispositivos' };
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

    return { message: 'Sesión cerrada' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<MessageDto> {
    const user = await this.repository.findById(userId);
    if (!user?.passwordHash) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('La contraseña actual es incorrecta');
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw new AppError(400, 'La nueva contraseña debe ser distinta', undefined, 'PASSWORD_REUSE');
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

    await notificationsService.notify({
      userId,
      type: NotificationType.SYSTEM,
      title: 'Contraseña actualizada',
      body: 'Tu contraseña de ConfiApp se cambió correctamente. Si no fuiste vos, recuperá el acceso de inmediato.',
      data: { href: '/perfil' },
      entityType: 'User',
      entityId: userId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  async forgotPassword(email: string): Promise<MessageDto> {
    const generic = {
      message: 'Si existe una cuenta con ese email, enviamos un enlace para restablecer la contraseña.',
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
    const branded = buildBrandedEmail({
      title: 'Restablecé tu contraseña',
      preheader: 'El enlace vence en 1 hora.',
      bodyHtml: emailParagraphs(
        'Pediste restablecer tu contraseña en ConfiApp.\n\nEl enlace vence en 1 hora. Si no fuiste vos, ignorá este mensaje.',
      ),
      cta: { label: 'Restablecer contraseña', href: resetUrl },
      footnote: 'Por seguridad, este enlace solo funciona una vez.',
    });
    await emailSender.send({
      to: user.email,
      subject: 'ConfiApp — Restablecé tu contraseña',
      text: `Pediste restablecer tu contraseña. El enlace vence en 1 hora:\n\n${resetUrl}\n\nSi no fuiste vos, ignorá este mensaje.`,
      html: branded.html,
      attachments: branded.attachments,
    });

    return generic;
  }

  async resetPassword(token: string, newPassword: string): Promise<MessageDto> {
    const user = await this.repository.findByPasswordResetHash(hashToken(token));
    if (!user) {
      throw new AppError(400, 'Enlace inválido o expirado', undefined, 'INVALID_TOKEN');
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

    await notificationsService.notify({
      userId: String(user._id),
      type: NotificationType.SYSTEM,
      title: 'Contraseña restablecida',
      body: 'Tu contraseña se restableció correctamente. Si no fuiste vos, contactá soporte.',
      data: { href: '/ingresar' },
      entityType: 'User',
      entityId: String(user._id),
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    });

    return { message: 'Contraseña restablecida correctamente' };
  }

  async verifyEmail(token: string): Promise<MessageDto> {
    const user = await this.repository.findByEmailVerificationHash(hashToken(token));
    if (!user) {
      throw new AppError(400, 'Enlace de verificación inválido o expirado', undefined, 'INVALID_TOKEN');
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

    return { message: 'Tu email quedó confirmado. Ya podés ingresar a ConfiApp.' };
  }

  async resendVerification(email: string): Promise<MessageDto> {
    const generic = {
      message: 'Si hay una cuenta sin verificar con ese email, enviamos un nuevo enlace.',
    };

    const user = await this.repository.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return generic;
    }

    const token = generateOpaqueToken();
    user.emailVerificationTokenHash = hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + VERIFY_TTL_MS);
    await this.repository.saveUser(user);
    setImmediate(() => {
      void this.sendVerificationEmail(user.email, token).catch((error) => {
        logger.error('auth.resend_email_failed', {
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    return generic;
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }
    return toAuthUser(user);
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${env.APP_URL}/verificar-email?token=${encodeURIComponent(token)}`;
    const branded = buildBrandedEmail({
      title: 'Confirmá tu email',
      preheader: 'Activá tu cuenta de ConfiApp para empezar a operar.',
      bodyHtml: emailParagraphs(
        'Gracias por registrarte en ConfiApp.\n\nTocá el botón para activar tu cuenta y poder ingresar.',
      ),
      cta: { label: 'Confirmar email', href: verifyUrl },
      footnote: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.',
    });
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
      html: branded.html,
      attachments: branded.attachments,
    });
  }
}
