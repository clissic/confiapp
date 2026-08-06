import type { HydratedDocument } from 'mongoose';
import type {
  DistanceUnit,
  IUser,
  ProfileVisibility,
  ThemePreference,
  UserPhotoKind,
  UserStatus,
} from '@confiapp/database';
import { IdentityVerificationStatus, UserPhotoKind as PhotoKind } from '@confiapp/database';

import { UserModel } from '../../database/models';

export type UserDocument = HydratedDocument<IUser>;

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  avatar?: string;
}

export interface UpdateUserData {
  fullName?: string;
  displayName?: string | null;
  documentNumber?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatar?: string | null;
  status?: UserStatus;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    formatted?: string;
  } | null;
  locationLabel?: string | null;
  photos?: Array<{
    url: string;
    storageKey?: string;
    kind?: UserPhotoKind;
    mimeType?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    isPrimary?: boolean;
  }>;
  /** Si true y hay ID_FRONT + SELFIE, pasa KYC a PENDING. */
  submitKyc?: boolean;
  kycReviewTokenHash?: string;
  kycReviewTokenExpiresAt?: Date;
  payoutMethods?: Array<{
    id?: string;
    bank: string;
    number: string;
    type: 'CA' | 'CC' | 'FINTECH';
    currency: 'UYU' | 'USD' | '';
    createdAt?: string;
  }>;
  preferences?: {
    language?: string;
    locale?: string;
    timezone?: string;
    currency?: string;
    theme?: ThemePreference;
    distanceUnit?: DistanceUnit;
    notifications?: Record<string, boolean | undefined>;
    privacy?: {
      showLocation?: boolean;
      showPhone?: boolean;
      showEmail?: boolean;
      showRating?: boolean;
      profileVisibility?: ProfileVisibility;
    };
  };
}

export class UsersRepository {
  async create(data: CreateUserData): Promise<UserDocument> {
    const user = await UserModel.create(data);
    return user;
  }

  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase(), deletedAt: null }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase(), deletedAt: null })
      .select('+passwordHash')
      .exec();
  }

  async findByKycReviewTokenHash(tokenHash: string): Promise<UserDocument | null> {
    const now = new Date();
    return UserModel.findOne({
      deletedAt: null,
      $or: [
        {
          'kyc.reviewTokenHash': tokenHash,
          'kyc.reviewTokenExpiresAt': { $gt: now },
        },
        {
          'verification.identity.reviewTokenHash': tokenHash,
          'verification.identity.reviewTokenExpiresAt': { $gt: now },
        },
      ],
    })
      .select('+kyc.reviewTokenHash +kyc.reviewTokenExpiresAt')
      .exec();
  }

  async updateById(id: string, data: UpdateUserData): Promise<UserDocument | null> {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (data.fullName !== undefined) $set.fullName = data.fullName;
    if (data.status !== undefined) $set.status = data.status;
    if (data.displayName !== undefined) {
      if (data.displayName === null) $unset.displayName = 1;
      else $set.displayName = data.displayName;
    }
    if (data.documentNumber !== undefined) {
      if (data.documentNumber === null) $unset.documentNumber = 1;
      else $set.documentNumber = data.documentNumber;
    }
    if (data.bio !== undefined) {
      if (data.bio === null) $unset.bio = 1;
      else $set.bio = data.bio;
    }
    if (data.phone !== undefined) {
      if (data.phone === null) {
        $unset.phone = 1;
        $unset.phoneVerifiedAt = 1;
        $set['verification.phone.verified'] = false;
      } else {
        const existing = await UserModel.findById(id).select('phone').lean().exec();
        const prevDigits = String(existing?.phone ?? '').replace(/\D/g, '');
        const nextDigits = String(data.phone).replace(/\D/g, '');
        $set.phone = data.phone;
        if (prevDigits !== nextDigits) {
          $unset.phoneVerifiedAt = 1;
          $set['verification.phone.verified'] = false;
        }
      }
    }
    if (data.avatar !== undefined) {
      if (data.avatar === null) $unset.avatar = 1;
      else $set.avatar = data.avatar;
    }
    if (data.locationLabel !== undefined) {
      if (data.locationLabel === null) $unset['location.label'] = 1;
      else $set['location.label'] = data.locationLabel;
    }
    if (data.address !== undefined) {
      if (data.address === null) {
        $set['location.address'] = {};
      } else {
        const country = data.address.country === '' ? undefined : data.address.country;
        $set['location.address'] = {
          line1: data.address.line1,
          line2: data.address.line2,
          city: data.address.city,
          state: data.address.state,
          country,
          postalCode: data.address.postalCode,
          formatted: data.address.formatted,
        };
        $set['location.updatedAt'] = new Date();
      }
    }
    if (data.photos !== undefined) {
      $set.photos = data.photos.map((photo) => ({
        url: photo.url,
        storageKey: photo.storageKey,
        kind: photo.kind ?? 'PROFILE',
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        width: photo.width,
        height: photo.height,
        isPrimary: Boolean(photo.isPrimary),
        uploadedAt: new Date(),
      }));
      const primary =
        data.photos.find(
          (p) =>
            p.isPrimary &&
            (p.kind === PhotoKind.AVATAR ||
              p.kind === PhotoKind.PROFILE ||
              p.kind === undefined),
        ) ??
        data.photos.find(
          (p) => p.kind === PhotoKind.AVATAR || p.kind === PhotoKind.PROFILE,
        );
      if (primary?.url) $set.avatar = primary.url;

      const kinds = new Set(data.photos.map((p) => p.kind));
      const hasKycDocs = kinds.has(PhotoKind.ID_FRONT) && kinds.has(PhotoKind.SELFIE);
      if (data.submitKyc && hasKycDocs) {
        const existing = await UserModel.findById(id)
          .select('kyc.status verification.identity.status')
          .lean()
          .exec();
        const currentStatus =
          existing?.kyc?.status ?? existing?.verification?.identity?.status;
        if (currentStatus !== IdentityVerificationStatus.VERIFIED) {
          $set['kyc.status'] = IdentityVerificationStatus.PENDING;
          $set['verification.identity.status'] = IdentityVerificationStatus.PENDING;
          if (data.kycReviewTokenHash) {
            $set['kyc.reviewTokenHash'] = data.kycReviewTokenHash;
            $set['verification.identity.reviewTokenHash'] = data.kycReviewTokenHash;
          }
          if (data.kycReviewTokenExpiresAt) {
            $set['kyc.reviewTokenExpiresAt'] = data.kycReviewTokenExpiresAt;
            $set['verification.identity.reviewTokenExpiresAt'] = data.kycReviewTokenExpiresAt;
          }
          $unset['kyc.rejectionReason'] = 1;
          $unset['kyc.rejectedAt'] = 1;
          $unset['verification.identity.rejectionReason'] = 1;
          $unset['verification.identity.rejectedAt'] = 1;
        }
      }
    }
    if (data.payoutMethods !== undefined) {
      $set.payoutMethods = data.payoutMethods.map((method) => {
        const doc: Record<string, unknown> = {
          bank: method.bank,
          number: method.number,
          type: method.type,
          currency: method.type === 'FINTECH' ? '' : method.currency,
          createdAt: method.createdAt ? new Date(method.createdAt) : new Date(),
        };
        if (method.id && /^[a-fA-F0-9]{24}$/.test(method.id)) {
          doc._id = method.id;
        }
        return doc;
      });
    }
    if (data.preferences !== undefined) {
      const prefs = data.preferences;
      if (prefs.language !== undefined) $set['preferences.language'] = prefs.language;
      if (prefs.locale !== undefined) $set['preferences.locale'] = prefs.locale;
      if (prefs.timezone !== undefined) $set['preferences.timezone'] = prefs.timezone;
      if (prefs.currency !== undefined) $set['preferences.currency'] = prefs.currency;
      if (prefs.theme !== undefined) $set['preferences.theme'] = prefs.theme;
      if (prefs.distanceUnit !== undefined) {
        $set['preferences.distanceUnit'] = prefs.distanceUnit;
      }
      if (prefs.notifications) {
        for (const [key, value] of Object.entries(prefs.notifications)) {
          if (value !== undefined) {
            $set[`preferences.notifications.${key}`] = value;
          }
        }
      }
      if (prefs.privacy) {
        for (const [key, value] of Object.entries(prefs.privacy)) {
          if (value !== undefined) {
            $set[`preferences.privacy.${key}`] = value;
          }
        }
      }
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    if (Object.keys(update).length === 0) {
      return this.findById(id);
    }

    return UserModel.findOneAndUpdate({ _id: id, deletedAt: null }, update, {
      new: true,
      runValidators: true,
    }).exec();
  }

  async listHistoryForUser(userId: string): Promise<
    Array<{
      id: string;
      type: 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'REVIEW' | 'PAYMENT';
      title: string;
      occurredAt: string;
      meta?: string;
    }>
  > {
    const { TransactionModel, ReviewModel, PaymentModel } = await import(
      '../../database/models'
    );

    const [transactions, reviews, payments] = await Promise.all([
      TransactionModel.find({
        deletedAt: null,
        $or: [{ createdBy: userId }, { 'participants.user': userId }],
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select('code title status updatedAt completedAt cancelledAt disputedAt')
        .lean()
        .exec(),
      ReviewModel.find({
        deletedAt: null,
        $or: [{ reviewer: userId }, { reviewee: userId }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('rating comment createdAt')
        .lean()
        .exec(),
      PaymentModel.find({
        deletedAt: null,
        $or: [{ payer: userId }, { payee: userId }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('type status amountCents currency createdAt')
        .lean()
        .exec(),
    ]);

    const mapTxType = (
      status: string,
    ): 'COMPLETED' | 'CANCELLED' | 'DISPUTED' => {
      if (status === 'DISPUTED') return 'DISPUTED';
      if (status === 'CANCELLED') return 'CANCELLED';
      return 'COMPLETED';
    };

    const history = [
      ...transactions.map((tx) => {
        const status = String(tx.status);
        return {
          id: String(tx._id),
          type: mapTxType(status),
          title: String(tx.title),
          occurredAt: (
            (tx.completedAt as Date | undefined) ??
            (tx.cancelledAt as Date | undefined) ??
            (tx.disputedAt as Date | undefined) ??
            (tx.updatedAt as Date)
          ).toISOString(),
          meta: `${tx.code} · ${status}`,
        };
      }),
      ...reviews.map((review) => ({
        id: String(review._id),
        type: 'REVIEW' as const,
        title: `Calificación ${review.rating}/5`,
        occurredAt: (review.createdAt as Date).toISOString(),
        meta: review.comment ? String(review.comment).slice(0, 80) : undefined,
      })),
      ...payments.map((payment) => ({
        id: String(payment._id),
        type: 'PAYMENT' as const,
        title: `${payment.type} · ${payment.status}`,
        occurredAt: (payment.createdAt as Date).toISOString(),
        meta: `${(payment.amountCents as number) / 100} ${payment.currency}`,
      })),
    ];

    return history
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 30);
  }
}
