import type {
  PlatformRole,
  ProfileVisibility,
  ThemePreference,
  DistanceUnit,
  UserStatus,
  WalletStatus,
  UserPhotoKind,
} from '@confiapp/database';

export interface RegisterUserDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  avatar?: string;
}

export interface UserAddressDto {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formatted?: string;
}

export interface UserPhotoDto {
  url: string;
  storageKey?: string;
  kind: UserPhotoKind;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  isPrimary: boolean;
  uploadedAt: string;
  verifiedAt?: string;
}

export interface UserPreferencesDto {
  language: string;
  locale: string;
  timezone: string;
  currency: string;
  theme: ThemePreference;
  distanceUnit: DistanceUnit;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
    marketing: boolean;
    transactionUpdates: boolean;
    messageAlerts: boolean;
    paymentAlerts: boolean;
    disputeAlerts: boolean;
  };
  privacy: {
    showLocation: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showRating: boolean;
    profileVisibility: ProfileVisibility;
  };
}

export interface UserPayoutMethodDto {
  id: string;
  bank: string;
  number: string;
  type: 'CA' | 'CC' | 'FINTECH';
  currency: 'UYU' | 'USD' | '';
  createdAt: string;
}

export interface UpdateUserDto {
  fullName?: string;
  displayName?: string | null;
  documentNumber?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatar?: string | null;
  status?: UserStatus;
  address?: UserAddressDto | null;
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
  submitKyc?: boolean;
  payoutMethods?: Array<{
    id?: string;
    bank: string;
    number: string;
    type: 'CA' | 'CC' | 'FINTECH';
    currency: 'UYU' | 'USD' | '';
    createdAt?: string;
  }>;
  preferences?: Partial<{
    language: string;
    locale: string;
    timezone: string;
    currency: string;
    theme: ThemePreference;
    distanceUnit: DistanceUnit;
    notifications: Partial<UserPreferencesDto['notifications']>;
    privacy: Partial<UserPreferencesDto['privacy']>;
  }>;
}

export interface UserPublicDto {
  id: string;
  email: string;
  phone?: string;
  phoneVerified: boolean;
  fullName: string;
  displayName?: string;
  documentNumber?: string;
  bio?: string;
  avatar?: string;
  status: UserStatus;
  role: PlatformRole;
  roles: PlatformRole[];
  emailVerified: boolean;
  address: UserAddressDto;
  locationLabel?: string;
  photos: UserPhotoDto[];
  payoutMethods: UserPayoutMethodDto[];
  wallet: {
    status: WalletStatus;
    currency: string;
    availableCents: number;
    pendingCents: number;
    heldCents: number;
    lifetimeEarnedCents: number;
    lifetimeSpentCents: number;
    lastMovementAt?: string;
  };
  rating: {
    average: number;
    count: number;
    weightedAverage?: number;
    distribution: {
      one: number;
      two: number;
      three: number;
      four: number;
      five: number;
    };
  };
  roleRatings: {
    buyer: {
      average: number;
      count: number;
      weightedAverage?: number;
    };
    seller: {
      average: number;
      count: number;
      weightedAverage?: number;
    };
    agent: {
      average: number;
      count: number;
      weightedAverage?: number;
    };
  };
  stats: {
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
    lastActiveAt?: string;
  };
  history: Array<{
    id: string;
    type: 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'REVIEW' | 'PAYMENT';
    title: string;
    occurredAt: string;
    meta?: string;
  }>;
  preferences: UserPreferencesDto;
  kyc: {
    status: string;
    verifiedAt?: string;
    rejectionReason?: string;
  };
  identityVerified: boolean;
  verification: {
    email: boolean;
    phone: boolean;
    identityStatus: string;
    addressStatus: string;
    photoStatus: string;
  };
  reputation: {
    score: number;
    completedTransactions: number;
    cancelledTransactions: number;
    disputedTransactions: number;
  };
  createdAt: string;
  updatedAt: string;
}
