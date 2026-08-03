import type { HydratedDocument } from 'mongoose';
import {
  DistanceUnit,
  PlatformRole,
  ProfileVisibility,
  ThemePreference,
  WalletStatus,
  type IUser,
} from '@confiapp/database';

import { AuthService } from '../auth/service';
import { ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import { AuditAction, AuditOutcome, auditService } from '../audit';

import type { RegisterUserDto, UpdateUserDto, UserPublicDto } from './dto';
import { UsersRepository, type UserDocument } from './repository';

function toPublicDto(
  user: HydratedDocument<IUser> | UserDocument,
  history: UserPublicDto['history'] = [],
): UserPublicDto {
  const wallet = user.wallet ?? {
    status: WalletStatus.ACTIVE,
    currency: 'UYU',
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
    currency: 'UYU',
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
    },
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

    const user = await this.repository.updateById(id, {
      fullName: input.fullName,
      displayName: input.displayName,
      bio: input.bio,
      phone: input.phone,
      avatar: input.avatar,
      status: input.status,
      address: input.address,
      locationLabel: input.locationLabel,
      photos: input.photos,
      preferences: input.preferences,
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    auditService.track({
      actor: actor.id,
      actorRole: actor.role,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        fields: Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined),
        statusChanged: input.status !== undefined,
      },
    });

    const history = await this.repository.listHistoryForUser(id);
    return toPublicDto(user, history);
  }
}
