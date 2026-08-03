import type { Types } from 'mongoose';

import type {
  AddressVerificationStatus,
  AgentOnboardingStatus,
  DayOfWeek,
  DistanceUnit,
  IdentityVerificationStatus,
  PlatformRole,
  ProfileVisibility,
  ThemePreference,
  UserPhotoKind,
  UserStatus,
  WalletStatus,
} from '../types/enums';

/** Verificación de identidad (KYC) — mantenida por compatibilidad y embebida en verification.identity. */
export interface UserKyc {
  status: IdentityVerificationStatus;
  provider?: string;
  externalId?: string;
  documentType?: string;
  /** Hash del documento; nunca el número en claro. */
  documentNumberHash?: string;
  verifiedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  reviewedBy?: Types.ObjectId;
}

/** Reputación agregada (compat). Preferir `rating` + `stats` para datos nuevos. */
export interface UserReputation {
  score: number;
  completedTransactions: number;
  cancelledTransactions: number;
  disputedTransactions: number;
}

export interface UserWallet {
  status: WalletStatus;
  currency: string;
  availableCents: number;
  pendingCents: number;
  heldCents: number;
  lifetimeEarnedCents: number;
  lifetimeSpentCents: number;
  lastMovementAt?: Date;
  providerCustomerId?: string;
}

export interface UserRatingDistribution {
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
}

export interface UserRating {
  average: number;
  count: number;
  sum: number;
  distribution: UserRatingDistribution;
  /** Suma de rating × weight (para promedio ponderado). */
  weightedSum?: number;
  /** Suma de weights. */
  weightTotal?: number;
  /** Promedio ponderado (fallback a average). */
  weightedAverage?: number;
}

/** Calificaciones desagregadas por rol de negocio. */
export interface UserRoleRatings {
  buyer: UserRating;
  seller: UserRating;
  agent: UserRating;
}

export interface UserStats {
  completedTransactions: number;
  cancelledTransactions: number;
  disputedTransactions: number;
  asCreatorCount: number;
  asCounterpartyCount: number;
  asAgentCount: number;
  totalVolumeCents: number;
  averageResponseMinutes: number;
  reviewsGiven: number;
  reviewsReceived: number;
  messagesSent: number;
  successRate: number;
  lastActiveAt?: Date;
}

export interface UserGeoPoint {
  type: 'Point';
  /** GeoJSON: [longitude, latitude] */
  coordinates: [number, number];
}

export interface UserAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formatted?: string;
}

export interface UserLocation {
  point?: UserGeoPoint;
  address: UserAddress;
  label?: string;
  coverageRadiusKm?: number;
  updatedAt?: Date;
}

export interface UserScheduleSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface UserScheduleException {
  date: Date;
  isAvailable: boolean;
  note?: string;
}

/** Horarios (especialmente agentes intermediarios). */
export interface UserSchedule {
  timezone: string;
  isAcceptingAssignments: boolean;
  maxActiveTransactions: number;
  weeklySlots: UserScheduleSlot[];
  exceptions: UserScheduleException[];
}

export interface UserPhoto {
  url: string;
  storageKey?: string;
  kind: UserPhotoKind;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  isPrimary: boolean;
  uploadedAt: Date;
  verifiedAt?: Date;
}

export interface UserChannelVerification {
  verified: boolean;
  verifiedAt?: Date;
}

export interface UserVerification {
  email: UserChannelVerification;
  phone: UserChannelVerification;
  identity: UserKyc;
  address: {
    status: AddressVerificationStatus;
    verifiedAt?: Date;
    notes?: string;
  };
  photo: {
    status: AddressVerificationStatus;
    verifiedAt?: Date;
    notes?: string;
  };
}

export interface UserNotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  marketing: boolean;
  transactionUpdates: boolean;
  messageAlerts: boolean;
  paymentAlerts: boolean;
  disputeAlerts: boolean;
}

export interface UserPrivacyPreferences {
  showLocation: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showRating: boolean;
  profileVisibility: ProfileVisibility;
}

export interface UserPreferences {
  language: string;
  locale: string;
  timezone: string;
  currency: string;
  theme: ThemePreference;
  distanceUnit: DistanceUnit;
  notifications: UserNotificationPreferences;
  privacy: UserPrivacyPreferences;
}

/** Capacidades / metadatos de administrador. */
export interface UserAdminProfile {
  permissions: string[];
  notes?: string;
  lastAdminActionAt?: Date;
}

/** Onboarding y datos operativos de intermediario. */
export interface UserAgentProfile {
  status: AgentOnboardingStatus;
  termsAccepted: boolean;
  termsAcceptedAt?: Date;
  termsVersion?: string;
  workAreaLabel?: string;
  workAreaCity?: string;
  workAreaCountry?: string;
  coverageRadiusKm?: number;
  /** Tarifa horaria en centavos. */
  hourlyRateCents?: number;
  currency: string;
  /** Paso del wizard persistido (1–5). */
  draftStep: number;
  submittedAt?: Date;
  activatedAt?: Date;
}

/**
 * Usuario de plataforma: USER | AGENT | ADMIN.
 * Incluye wallet, rating, estadísticas, geo, horarios, fotos, verificación y preferencias.
 */
export interface IUser {
  email: string;
  phone?: string;
  passwordHash: string;
  fullName: string;
  displayName?: string;
  bio?: string;
  dateOfBirth?: Date;
  /** URL rápida de avatar (también puede existir en photos). */
  avatar?: string;
  status: UserStatus;
  /** Rol primario (JWT / autorización rápida). */
  role: PlatformRole;
  /** Roles asignados (usuario, agente, administrador). */
  roles: PlatformRole[];
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  wallet: UserWallet;
  rating: UserRating;
  /** Promedios por rol (reseñas recibidas actuando como buyer/seller/agent). */
  roleRatings: UserRoleRatings;
  stats: UserStats;
  /** @deprecated Preferir stats + rating; se mantiene sincronizable. */
  reputation: UserReputation;
  location: UserLocation;
  schedule: UserSchedule;
  photos: UserPhoto[];
  verification: UserVerification;
  /** @deprecated Preferir verification.identity */
  kyc: UserKyc;
  preferences: UserPreferences;
  agent: UserAgentProfile;
  admin?: UserAdminProfile;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type UserId = Types.ObjectId | string;

export interface IRefreshToken {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}
