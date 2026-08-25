import {
  AddressVerificationStatus,
  IdentityVerificationStatus,
  PlatformRole,
  UserStatus,
} from '@confiapp/database';

import { UserModel } from '../../database/models';
import { env } from '../../shared/config/env';
import { hashPassword } from '../../utils/password';
import { logger } from '../../utils/logger';

/**
 * Asegura un usuario ADMIN (email verificado, activo) a partir de env.
 * No-op si faltan ADMIN_EMAIL / ADMIN_PASSWORD.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? '';
  const fullName = (env.ADMIN_FULL_NAME?.trim() || 'ConfiApp Admin').slice(0, 120);

  if (!email || !password) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.warn('bootstrap admin skipped: ADMIN_EMAIL inválido');
    return;
  }

  if (password.length < 8 || password.length > 128) {
    logger.warn('bootstrap admin skipped: ADMIN_PASSWORD debe tener 8–128 caracteres');
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  const existing = await UserModel.findOne({ email, deletedAt: null })
    .select('+passwordHash')
    .exec();

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.fullName = fullName;
    existing.role = PlatformRole.ADMIN;
    existing.roles = [PlatformRole.ADMIN];
    existing.status = UserStatus.ACTIVE;
    existing.emailVerifiedAt = existing.emailVerifiedAt ?? now;
    existing.failedLoginAttempts = 0;
    existing.set('lockUntil', undefined);
    existing.set('emailVerificationTokenHash', undefined);
    existing.set('emailVerificationExpires', undefined);
    existing.set('deletedAt', null);
    if (!existing.verification) {
      existing.verification = {
        email: { verified: true, verifiedAt: now },
        phone: { verified: false },
        identity: { status: IdentityVerificationStatus.UNVERIFIED },
        address: { status: AddressVerificationStatus.UNVERIFIED },
        photo: { status: AddressVerificationStatus.UNVERIFIED },
      };
    } else {
      existing.verification.email = { verified: true, verifiedAt: now };
    }
    await existing.save();
    logger.info('bootstrap admin updated', { email, userId: String(existing._id) });
    return;
  }

  const created = await UserModel.create({
    email,
    passwordHash,
    fullName,
    phone: '+59899000000',
    documentNumber: 'ADMIN-001',
    role: PlatformRole.ADMIN,
    roles: [PlatformRole.ADMIN],
    status: UserStatus.ACTIVE,
    emailVerifiedAt: now,
    failedLoginAttempts: 0,
    verification: {
      email: { verified: true, verifiedAt: now },
      phone: { verified: false },
      identity: { status: IdentityVerificationStatus.UNVERIFIED },
      address: { status: AddressVerificationStatus.UNVERIFIED },
      photo: { status: AddressVerificationStatus.UNVERIFIED },
    },
  });

  logger.info('bootstrap admin created', { email, userId: String(created._id) });
}
