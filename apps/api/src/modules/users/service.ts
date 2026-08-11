import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import {
  DistanceUnit,
  IdentityVerificationStatus,
  NotificationChannel,
  NotificationType,
  PlatformRole,
  ProfileVisibility,
  ThemePreference,
  UserPhotoKind,
  WalletStatus,
  type IUser,
} from '@confiapp/database';

import { AuthService } from '../auth/service';
import { ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import { generateOpaqueToken, hashToken } from '../../utils/crypto-tokens';
import { AuditAction, AuditOutcome, auditService } from '../audit';
import {
  buildAuditUpdatePayload,
  formatAddressAudit,
  pushAuditChange,
  type AuditFieldChange,
} from '../audit/diff';
import { notificationsService } from '../notifications/service';
import { computeReputationScore } from '../reviews/scoring';

import type { RegisterUserDto, UpdateUserDto, UserPublicDto } from './dto';
import { sendKycReviewEmail } from './kyc-email';
import { UsersRepository, type UserDocument } from './repository';

const KYC_REVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function collectUserUpdateChanges(
  before: HydratedDocument<IUser> | UserDocument,
  input: UpdateUserDto,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  if (input.fullName !== undefined) {
    pushAuditChange(changes, 'fullName', before.fullName, input.fullName);
  }
  if (input.displayName !== undefined) {
    pushAuditChange(changes, 'displayName', before.displayName, input.displayName);
  }
  if (input.documentNumber !== undefined) {
    pushAuditChange(changes, 'documentNumber', before.documentNumber, input.documentNumber);
  }
  if (input.bio !== undefined) {
    pushAuditChange(changes, 'bio', before.bio, input.bio);
  }
  if (input.phone !== undefined) {
    pushAuditChange(changes, 'phone', before.phone, input.phone);
  }
  if (input.avatar !== undefined) {
    pushAuditChange(changes, 'avatar', before.avatar, input.avatar);
  }
  if (input.status !== undefined) {
    pushAuditChange(changes, 'status', before.status, input.status);
  }
  if (input.locationLabel !== undefined) {
    pushAuditChange(
      changes,
      'locationLabel',
      before.location?.label,
      input.locationLabel,
    );
  }
  if (input.address !== undefined) {
    pushAuditChange(
      changes,
      'address',
      formatAddressAudit(before.location?.address),
      formatAddressAudit(input.address),
    );
  }
  if (input.photos !== undefined) {
    pushAuditChange(changes, 'photos', before.photos?.length ?? 0, input.photos.length);
  }
  if (input.payoutMethods !== undefined) {
    pushAuditChange(
      changes,
      'payoutMethods',
      before.payoutMethods?.length ?? 0,
      input.payoutMethods.length,
    );
  }
  if (input.preferences !== undefined) {
    const prev = before.preferences ?? {};
    const next = input.preferences;
    for (const key of [
      'language',
      'locale',
      'timezone',
      'currency',
      'theme',
      'distanceUnit',
    ] as const) {
      if (next[key] !== undefined) {
        pushAuditChange(changes, `preferences.${key}`, prev[key], next[key]);
      }
    }
    if (next.notifications) {
      for (const [key, value] of Object.entries(next.notifications)) {
        if (value !== undefined) {
          pushAuditChange(
            changes,
            `preferences.notifications.${key}`,
            (prev.notifications as unknown as Record<string, unknown> | undefined)?.[key],
            value,
          );
        }
      }
    }
    if (next.privacy) {
      for (const [key, value] of Object.entries(next.privacy)) {
        if (value !== undefined) {
          pushAuditChange(
            changes,
            `preferences.privacy.${key}`,
            (prev.privacy as unknown as Record<string, unknown> | undefined)?.[key],
            value,
          );
        }
      }
    }
  }
  if (input.submitKyc) {
    pushAuditChange(
      changes,
      'kyc',
      before.kyc?.status ?? before.verification?.identity?.status,
      IdentityVerificationStatus.PENDING,
    );
  }

  return changes;
}

function userUpdateAuditNote(input: UpdateUserDto, changes: AuditFieldChange[]): string {
  if (input.submitKyc) return 'Envío de verificación de identidad';
  if (input.status !== undefined) return 'Cambio de estado de usuario';
  if (
    input.preferences !== undefined &&
    changes.length > 0 &&
    changes.every((change) => change.field.startsWith('preferences.'))
  ) {
    return 'Cambio de configuración';
  }
  if (input.payoutMethods !== undefined) return 'Actualización de métodos de cobro';
  if (input.photos !== undefined) return 'Actualización de fotos';
  if (
    input.fullName !== undefined ||
    input.displayName !== undefined ||
    input.phone !== undefined ||
    input.bio !== undefined ||
    input.avatar !== undefined ||
    input.documentNumber !== undefined ||
    input.address !== undefined ||
    input.locationLabel !== undefined
  ) {
    return 'Actualización de perfil';
  }
  return 'Actualización de usuario';
}

function toPublicDto(
  user: HydratedDocument<IUser> | UserDocument,
  history: UserPublicDto['history'] = [],
): UserPublicDto {
  const wallet = user.wallet ?? {
    status: WalletStatus.ACTIVE,
    currency: 'USD',
    availableCents: 0,
    pendingCents: 0,
    heldCents: 0,
    lifetimeEarnedCents: 0,
    lifetimeSpentCents: 0,
  };
  const rating = user.rating ?? {
    average: 0,
    count: 0,
    sum: 0,
    distribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
  };
  const stats = user.stats ?? {
    completedTransactions: user.reputation?.completedTransactions ?? 0,
    cancelledTransactions: user.reputation?.cancelledTransactions ?? 0,
    disputedTransactions: user.reputation?.disputedTransactions ?? 0,
    asCreatorCount: 0,
    asCounterpartyCount: 0,
    asAgentCount: 0,
    totalVolumeCents: 0,
    averageResponseMinutes: 0,
    reviewsGiven: 0,
    reviewsReceived: 0,
    messagesSent: 0,
    successRate: 0,
  };
  const preferences = user.preferences ?? {
    language: 'es',
    locale: 'es-AR',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'USD',
    theme: ThemePreference.SYSTEM,
    distanceUnit: DistanceUnit.KM,
    notifications: {
      email: true,
      push: true,
      sms: false,
      inApp: true,
      marketing: false,
      transactionUpdates: true,
      messageAlerts: true,
      paymentAlerts: true,
      disputeAlerts: true,
    },
    privacy: {
      showLocation: false,
      showPhone: false,
      showEmail: false,
      showRating: true,
      profileVisibility: ProfileVisibility.PUBLIC,
    },
  };

  return {
    id: user.id as string,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt ?? user.verification?.phone?.verified),
    fullName: user.fullName,
    displayName: user.displayName,
    documentNumber: user.documentNumber,
    bio: user.bio,
    avatar: user.avatar,
    status: user.status,
    role: user.role ?? PlatformRole.USER,
    roles: user.roles?.length ? user.roles : [user.role ?? PlatformRole.USER],
    emailVerified: Boolean(user.emailVerifiedAt),
    address: {
      line1: user.location?.address?.line1,
      line2: user.location?.address?.line2,
      city: user.location?.address?.city,
      state: user.location?.address?.state,
      country: user.location?.address?.country,
      postalCode: user.location?.address?.postalCode,
      formatted: user.location?.address?.formatted,
    },
    locationLabel: user.location?.label,
    photos: (user.photos ?? []).map((photo) => ({
      url: photo.url,
      storageKey: photo.storageKey,
      kind: photo.kind,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      width: photo.width,
      height: photo.height,
      isPrimary: photo.isPrimary,
      uploadedAt: photo.uploadedAt?.toISOString?.() ?? new Date().toISOString(),
      verifiedAt: photo.verifiedAt?.toISOString?.(),
    })),
    payoutMethods: (user.payoutMethods ?? []).map((method, index) => {
      const raw = method as typeof method & { _id?: { toString(): string }; id?: string };
      return {
        id: raw.id ?? raw._id?.toString?.() ?? `payout-${index}`,
        bank: method.bank,
        number: method.number,
        type: method.type,
        currency: method.currency ?? '',
        createdAt: method.createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    }),
    wallet: {
      status: wallet.status,
      currency: wallet.currency,
      availableCents: wallet.availableCents,
      pendingCents: wallet.pendingCents,
      heldCents: wallet.heldCents,
      lifetimeEarnedCents: wallet.lifetimeEarnedCents,
      lifetimeSpentCents: wallet.lifetimeSpentCents,
      lastMovementAt: wallet.lastMovementAt?.toISOString?.(),
    },
    rating: {
      average: rating.average,
      count: rating.count,
      weightedAverage: rating.weightedAverage ?? rating.average,
      distribution: rating.distribution,
    },
    roleRatings: {
      buyer: {
        average: user.roleRatings?.buyer?.average ?? 0,
        count: user.roleRatings?.buyer?.count ?? 0,
        weightedAverage:
          user.roleRatings?.buyer?.weightedAverage ??
          user.roleRatings?.buyer?.average ??
          0,
      },
      seller: {
        average: user.roleRatings?.seller?.average ?? 0,
        count: user.roleRatings?.seller?.count ?? 0,
        weightedAverage:
          user.roleRatings?.seller?.weightedAverage ??
          user.roleRatings?.seller?.average ??
          0,
      },
      agent: {
        average: user.roleRatings?.agent?.average ?? 0,
        count: user.roleRatings?.agent?.count ?? 0,
        weightedAverage:
          user.roleRatings?.agent?.weightedAverage ??
          user.roleRatings?.agent?.average ??
          0,
      },
    },
    stats: {
      completedTransactions: stats.completedTransactions,
      cancelledTransactions: stats.cancelledTransactions,
      disputedTransactions: stats.disputedTransactions,
      asCreatorCount: stats.asCreatorCount,
      asCounterpartyCount: stats.asCounterpartyCount,
      asAgentCount: stats.asAgentCount,
      totalVolumeCents: stats.totalVolumeCents,
      averageResponseMinutes: stats.averageResponseMinutes,
      reviewsGiven: stats.reviewsGiven,
      reviewsReceived: stats.reviewsReceived,
      messagesSent: stats.messagesSent,
      successRate: stats.successRate,
      lastActiveAt: stats.lastActiveAt?.toISOString?.(),
    },
    history,
    preferences: {
      language: preferences.language,
      locale: preferences.locale,
      timezone: preferences.timezone,
      currency: preferences.currency,
      theme: preferences.theme,
      distanceUnit: preferences.distanceUnit,
      notifications: {
        email: preferences.notifications.email,
        push: preferences.notifications.push,
        sms: preferences.notifications.sms,
        inApp: preferences.notifications.inApp,
        marketing: preferences.notifications.marketing,
        transactionUpdates: preferences.notifications.transactionUpdates,
        messageAlerts: preferences.notifications.messageAlerts,
        paymentAlerts: preferences.notifications.paymentAlerts,
        disputeAlerts: preferences.notifications.disputeAlerts,
      },
      privacy: {
        showLocation: preferences.privacy.showLocation,
        showPhone: preferences.privacy.showPhone,
        showEmail: preferences.privacy.showEmail,
        showRating: preferences.privacy.showRating,
        profileVisibility: preferences.privacy.profileVisibility,
      },
    },
    kyc: {
      status: user.kyc?.status ?? user.verification?.identity?.status ?? 'UNVERIFIED',
      verifiedAt: (
        user.kyc?.verifiedAt ?? user.verification?.identity?.verifiedAt
      )?.toISOString?.(),
      rejectionReason:
        user.kyc?.rejectionReason ?? user.verification?.identity?.rejectionReason,
    },
    identityVerified:
      (user.kyc?.status ?? user.verification?.identity?.status) ===
      IdentityVerificationStatus.VERIFIED,
    verification: {
      email: Boolean(user.emailVerifiedAt ?? user.verification?.email?.verified),
      phone: Boolean(user.phoneVerifiedAt ?? user.verification?.phone?.verified),
      identityStatus: user.verification?.identity?.status ?? user.kyc?.status ?? 'UNVERIFIED',
      addressStatus: user.verification?.address?.status ?? 'UNVERIFIED',
      photoStatus: user.verification?.photo?.status ?? 'UNVERIFIED',
    },
    reputation: {
      score: user.reputation?.score ?? 0,
      completedTransactions: user.reputation?.completedTransactions ?? 0,
      cancelledTransactions: user.reputation?.cancelledTransactions ?? 0,
      disputedTransactions: user.reputation?.disputedTransactions ?? 0,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class UsersService {
  constructor(
    private readonly repository = new UsersRepository(),
    private readonly authService = new AuthService(),
  ) {}

  async register(input: RegisterUserDto) {
    return this.authService.register({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      documentNumber: input.documentNumber,
      phone: input.phone,
    });
  }

  async getById(
    id: string,
    viewer?: { viewerId: string; viewerRole: PlatformRole },
  ): Promise<UserPublicDto> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const canSeeHistory =
      !viewer ||
      viewer.viewerId === id ||
      viewer.viewerRole === PlatformRole.ADMIN;
    const history = canSeeHistory
      ? await this.repository.listHistoryForUser(id)
      : [];
    return toPublicDto(user, history);
  }

  async getMe(userId: string): Promise<UserPublicDto> {
    return this.getById(userId, {
      viewerId: userId,
      viewerRole: PlatformRole.USER,
    });
  }

  async updateById(
    actor: { id: string; role: PlatformRole },
    id: string,
    input: UpdateUserDto,
  ): Promise<UserPublicDto> {
    const isSelf = actor.id === id;
    const isAdmin = actor.role === PlatformRole.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError('You can only update your own profile');
    }

    if (input.status !== undefined && !isAdmin) {
      throw new ForbiddenError('Only admins can change user status');
    }

    const before = await this.repository.findById(id);
    if (!before) {
      throw new NotFoundError('User not found');
    }

    let reviewToken: string | undefined;
    let reviewTokenHash: string | undefined;
    let reviewTokenExpiresAt: Date | undefined;
    if (input.submitKyc) {
      reviewToken = generateOpaqueToken();
      reviewTokenHash = hashToken(reviewToken);
      reviewTokenExpiresAt = new Date(Date.now() + KYC_REVIEW_TTL_MS);
    }

    const user = await this.repository.updateById(id, {
      fullName: input.fullName,
      displayName: input.displayName,
      documentNumber: input.documentNumber,
      bio: input.bio,
      phone: input.phone,
      avatar: input.avatar,
      status: input.status,
      address: input.address,
      locationLabel: input.locationLabel,
      photos: input.photos,
      submitKyc: input.submitKyc,
      kycReviewTokenHash: reviewTokenHash,
      kycReviewTokenExpiresAt: reviewTokenExpiresAt,
      payoutMethods: input.payoutMethods,
      preferences: input.preferences,
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (input.submitKyc && reviewToken) {
      const requiredKinds = [UserPhotoKind.ID_FRONT, UserPhotoKind.SELFIE];
      const fromPayload = (input.photos ?? []).filter((photo) =>
        requiredKinds.includes(photo.kind as UserPhotoKind),
      );
      const fromUser = (user.photos ?? []).filter((photo) =>
        [UserPhotoKind.ID_FRONT, UserPhotoKind.ID_BACK, UserPhotoKind.SELFIE].includes(
          photo.kind as UserPhotoKind,
        ),
      );
      // Preferir el payload del request (data URLs intactas) para adjuntar al mail.
      const kycPhotos = fromPayload.length >= 2 ? fromPayload : fromUser;
      await sendKycReviewEmail({
        userId: String(user._id),
        fullName: user.fullName,
        email: user.email,
        reviewToken,
        photos: kycPhotos.map((photo) => ({ kind: photo.kind, url: photo.url })),
      });
    }

    const changes = collectUserUpdateChanges(before, input);
    if (changes.length > 0 || input.submitKyc) {
      auditService.track({
        actor: actor.id,
        actorRole: actor.role,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: id,
        outcome: AuditOutcome.SUCCESS,
        metadata: buildAuditUpdatePayload(changes, {
          note: userUpdateAuditNote(input, changes),
          statusChanged: input.status !== undefined,
          kycSubmitted: Boolean(input.submitKyc),
        }),
      });
    }

    const history = await this.repository.listHistoryForUser(id);
    return toPublicDto(user, history);
  }

  async getKycReviewByToken(token: string) {
    const tokenHash = hashToken(token);
    const user = await this.repository.findByKycReviewTokenHash(tokenHash);
    if (!user) throw new NotFoundError('Solicitud de KYC no encontrada o expirada');

    const status = user.kyc?.status ?? user.verification?.identity?.status;
    const photos = (user.photos ?? [])
      .filter((photo) =>
        [UserPhotoKind.ID_FRONT, UserPhotoKind.ID_BACK, UserPhotoKind.SELFIE].includes(
          photo.kind as UserPhotoKind,
        ),
      )
      .map((photo) => ({
        kind: photo.kind,
        url: photo.url,
        uploadedAt: photo.uploadedAt?.toISOString?.() ?? new Date().toISOString(),
      }));

    return {
      userId: String(user._id),
      fullName: user.fullName,
      email: user.email,
      documentNumber: user.documentNumber,
      status,
      photos,
      submittedAt: user.updatedAt?.toISOString?.(),
    };
  }

  async decideKycReview(
    actor: { id: string; role: PlatformRole },
    token: string,
    decision: { action: 'approve' | 'reject'; reason?: string },
  ) {
    if (actor.role !== PlatformRole.ADMIN) {
      throw new ForbiddenError('Solo administradores pueden decidir KYC');
    }

    const tokenHash = hashToken(token);
    const user = await this.repository.findByKycReviewTokenHash(tokenHash);
    if (!user) throw new NotFoundError('Solicitud de KYC no encontrada o expirada');

    const previousKycStatus = user.kyc?.status ?? user.verification?.identity?.status;

    if (decision.action === 'approve') {
      user.kyc = user.kyc ?? { status: IdentityVerificationStatus.UNVERIFIED };
      user.kyc.status = IdentityVerificationStatus.VERIFIED;
      user.kyc.verifiedAt = new Date();
      user.kyc.rejectionReason = undefined;
      user.kyc.rejectedAt = undefined;
      user.kyc.reviewTokenHash = undefined;
      user.kyc.reviewTokenExpiresAt = undefined;
      if (user.verification?.identity) {
        user.verification.identity.status = IdentityVerificationStatus.VERIFIED;
        user.verification.identity.verifiedAt = new Date();
        user.verification.identity.rejectionReason = undefined;
        user.verification.identity.rejectedAt = undefined;
        user.verification.identity.reviewTokenHash = undefined;
        user.verification.identity.reviewTokenExpiresAt = undefined;
      }
      const breakdown = computeReputationScore({
        rating: user.rating,
        stats: user.stats,
        reputation: user.reputation,
        kycStatus: IdentityVerificationStatus.VERIFIED,
      });
      user.reputation = user.reputation ?? {
        score: 0,
        completedTransactions: 0,
        cancelledTransactions: 0,
        disputedTransactions: 0,
      };
      user.reputation.score = breakdown.score;
    } else {
      user.kyc = user.kyc ?? { status: IdentityVerificationStatus.UNVERIFIED };
      user.kyc.status = IdentityVerificationStatus.REJECTED;
      user.kyc.rejectedAt = new Date();
      user.kyc.rejectionReason = decision.reason?.trim() || 'Documentación insuficiente';
      user.kyc.reviewTokenHash = undefined;
      user.kyc.reviewTokenExpiresAt = undefined;
      if (user.verification?.identity) {
        user.verification.identity.status = IdentityVerificationStatus.REJECTED;
        user.verification.identity.rejectedAt = new Date();
        user.verification.identity.rejectionReason = user.kyc.rejectionReason;
        user.verification.identity.reviewTokenHash = undefined;
        user.verification.identity.reviewTokenExpiresAt = undefined;
      }
    }

    user.kyc.reviewedBy = new Types.ObjectId(actor.id);
    await user.save();

    auditService.track({
      actor: actor.id,
      actorRole: actor.role,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: String(user._id),
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        kycDecision: decision.action,
        reason: decision.reason,
        from: previousKycStatus,
        to:
          decision.action === 'approve'
            ? IdentityVerificationStatus.VERIFIED
            : IdentityVerificationStatus.REJECTED,
        summary: `${previousKycStatus ?? '—'} > ${
          decision.action === 'approve'
            ? IdentityVerificationStatus.VERIFIED
            : IdentityVerificationStatus.REJECTED
        }`,
        changes: [
          {
            field: 'kyc.status',
            from: previousKycStatus ?? '—',
            to:
              decision.action === 'approve'
                ? IdentityVerificationStatus.VERIFIED
                : IdentityVerificationStatus.REJECTED,
          },
        ],
      },
    });

    if (decision.action === 'approve') {
      await notificationsService.notify({
        userId: String(user._id),
        type: NotificationType.SYSTEM,
        title: 'Identidad verificada',
        body: 'Tu verificación de identidad fue aprobada. Ya podés operar con más confianza en ConfiApp.',
        data: { href: '/perfil' },
        entityType: 'User',
        entityId: String(user._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    } else {
      await notificationsService.notify({
        userId: String(user._id),
        type: NotificationType.SYSTEM,
        title: 'No pudimos verificar tu identidad',
        body: `Revisá la documentación y volvé a intentarlo. Motivo: ${
          user.kyc?.rejectionReason ?? 'Documentación insuficiente'
        }.`,
        data: { href: '/perfil' },
        entityType: 'User',
        entityId: String(user._id),
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
    }

    return toPublicDto(user);
  }
}
