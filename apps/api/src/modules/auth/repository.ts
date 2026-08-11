import type { HydratedDocument } from 'mongoose';
import {
  AddressVerificationStatus,
  IdentityVerificationStatus,
  PlatformRole,
  UserStatus,
  type IRefreshToken,
  type IUser,
} from '@confiapp/database';

import { RefreshTokenModel, UserModel } from '../../database/models';

export type UserDocument = HydratedDocument<IUser>;
export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;

const AUTH_USER_SELECT =
  '+passwordHash +lockUntil +emailVerificationTokenHash +emailVerificationExpires +passwordResetTokenHash +passwordResetExpires';

export class AuthRepository {
  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string;
    documentNumber: string;
    emailVerificationTokenHash: string;
    emailVerificationExpires: Date;
  }): Promise<UserDocument> {
    return UserModel.create({
      ...data,
      role: PlatformRole.USER,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      // Tener teléfono en el alta no implica verificación OTP.
      phoneVerifiedAt: undefined,
      verification: {
        email: { verified: false },
        phone: { verified: false },
        identity: { status: IdentityVerificationStatus.UNVERIFIED },
        address: { status: AddressVerificationStatus.UNVERIFIED },
        photo: { status: AddressVerificationStatus.UNVERIFIED },
      },
    });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase(), deletedAt: null })
      .select(AUTH_USER_SELECT)
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findOne({ _id: id, deletedAt: null }).select(AUTH_USER_SELECT).exec();
  }

  async saveUser(user: UserDocument): Promise<UserDocument> {
    return user.save();
  }

  async findByEmailVerificationHash(hash: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      emailVerificationTokenHash: hash,
      emailVerificationExpires: { $gt: new Date() },
      deletedAt: null,
    })
      .select(AUTH_USER_SELECT)
      .exec();
  }

  async findByPasswordResetHash(hash: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      passwordResetTokenHash: hash,
      passwordResetExpires: { $gt: new Date() },
      deletedAt: null,
    })
      .select(AUTH_USER_SELECT)
      .exec();
  }

  async createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create({
      user: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
    });
  }

  async findRefreshTokenByHash(hash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash: hash }).exec();
  }

  async revokeRefreshToken(token: RefreshTokenDocument, replacedBy?: string): Promise<void> {
    token.revokedAt = new Date();
    if (replacedBy) token.replacedByTokenHash = replacedBy;
    await token.save();
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { user: userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }
}
