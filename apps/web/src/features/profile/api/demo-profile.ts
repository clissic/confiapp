import type { ProfileUpdatePayload, UserProfile } from '../model/types';

const DEMO_KEY = 'confiapp.profile.demo';

export function createDemoProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: '000000000000000000000001',
    email: 'joaquin@confiapp.demo',
    phone: '+5491100000001',
    phoneVerified: true,
    fullName: 'Joaquín Creator',
    displayName: 'Joaquín C.',
    bio: 'Comprador y vendedor en operaciones de escrow físico con ConfiApp.',
    avatar: undefined,
    status: 'ACTIVE',
    role: 'USER',
    roles: ['USER'],
    emailVerified: true,
    address: {
      line1: 'Av. Libertador 1000',
      city: 'Buenos Aires',
      state: 'CABA',
      country: 'AR',
      postalCode: 'C1425',
    },
    locationLabel: 'Palermo, CABA',
    photos: [],
    wallet: {
      status: 'ACTIVE',
      currency: 'UYU',
      availableCents: 1250000,
      pendingCents: 150000,
      heldCents: 420000,
      lifetimeEarnedCents: 8900000,
      lifetimeSpentCents: 5400000,
      lastMovementAt: now,
    },
    rating: {
      average: 4.6,
      count: 18,
      weightedAverage: 4.55,
      distribution: { one: 0, two: 1, three: 2, four: 5, five: 10 },
    },
    roleRatings: {
      buyer: { average: 4.7, count: 8, weightedAverage: 4.65 },
      seller: { average: 4.5, count: 10, weightedAverage: 4.48 },
      agent: { average: 0, count: 0, weightedAverage: 0 },
    },
    stats: {
      completedTransactions: 14,
      cancelledTransactions: 1,
      disputedTransactions: 1,
      asCreatorCount: 8,
      asCounterpartyCount: 6,
      asAgentCount: 0,
      totalVolumeCents: 15200000,
      averageResponseMinutes: 38,
      reviewsGiven: 12,
      reviewsReceived: 18,
      messagesSent: 240,
      successRate: 93,
      lastActiveAt: now,
    },
    history: [
      {
        id: 'h1',
        type: 'COMPLETED',
        title: 'Entrega de notebook reacondicionada',
        occurredAt: now,
        meta: 'DEMO-001 · COMPLETED',
      },
      {
        id: 'h2',
        type: 'PAYMENT',
        title: 'ESCROW_HOLD · CAPTURED',
        occurredAt: now,
        meta: '4200 UYU',
      },
      {
        id: 'h3',
        type: 'REVIEW',
        title: 'Calificación 5/5',
        occurredAt: now,
        meta: 'Operación confiable y puntual',
      },
    ],
    preferences: {
      language: 'es',
      locale: 'es-UY',
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'UYU',
      theme: 'SYSTEM',
      distanceUnit: 'KM',
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
        profileVisibility: 'PUBLIC',
      },
    },
    kyc: { status: 'VERIFIED', verifiedAt: now },
    verification: {
      email: true,
      phone: true,
      identityStatus: 'VERIFIED',
      addressStatus: 'PENDING',
      photoStatus: 'UNVERIFIED',
    },
    reputation: {
      score: 92,
      completedTransactions: 14,
      cancelledTransactions: 1,
      disputedTransactions: 1,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function loadDemoProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return createDemoProfile();
    return { ...createDemoProfile(), ...JSON.parse(raw) } as UserProfile;
  } catch {
    return createDemoProfile();
  }
}

export function saveDemoProfile(profile: UserProfile): UserProfile {
  const next = { ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(DEMO_KEY, JSON.stringify(next));
  return next;
}

export function applyDemoUpdate(
  current: UserProfile,
  payload: ProfileUpdatePayload,
): UserProfile {
  const next: UserProfile = {
    ...current,
    fullName: payload.fullName ?? current.fullName,
    displayName:
      payload.displayName === null
        ? undefined
        : (payload.displayName ?? current.displayName),
    bio: payload.bio === null ? undefined : (payload.bio ?? current.bio),
    phone: payload.phone === null ? undefined : (payload.phone ?? current.phone),
    avatar: payload.avatar === null ? undefined : (payload.avatar ?? current.avatar),
    address: payload.address === null ? {} : (payload.address ?? current.address),
    locationLabel:
      payload.locationLabel === null
        ? undefined
        : (payload.locationLabel ?? current.locationLabel),
    photos: payload.photos
      ? payload.photos.map((photo, index) => ({
          url: photo.url,
          kind: photo.kind ?? 'PROFILE',
          isPrimary: Boolean(photo.isPrimary) || index === 0,
          uploadedAt: new Date().toISOString(),
        }))
      : current.photos,
    preferences: payload.preferences
      ? {
          ...current.preferences,
          ...payload.preferences,
          notifications: {
            ...current.preferences.notifications,
            ...payload.preferences.notifications,
          },
          privacy: {
            ...current.preferences.privacy,
            ...payload.preferences.privacy,
          },
        }
      : current.preferences,
  };

  if (payload.photos?.length) {
    const primary = payload.photos.find((p) => p.isPrimary) ?? payload.photos[0];
    if (primary?.url) next.avatar = primary.url;
  }

  return saveDemoProfile(next);
}
