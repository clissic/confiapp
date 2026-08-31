export type ProfileVisibility = 'PUBLIC' | 'PRIVATE' | 'CONTACTS';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';
export type DistanceUnit = 'KM' | 'MI';
export type UserPhotoKind =
  | 'AVATAR'
  | 'PROFILE'
  | 'ID_FRONT'
  | 'ID_BACK'
  | 'SELFIE'
  | 'ADDRESS_PROOF'
  | 'OTHER';

export interface ProfileAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formatted?: string;
}

export interface ProfilePhoto {
  url: string;
  kind: UserPhotoKind;
  isPrimary: boolean;
  uploadedAt: string;
}

export interface ProfilePayoutMethod {
  id: string;
  bank: string;
  number: string;
  type: 'CA' | 'CC' | 'FINTECH';
  currency: 'UYU' | 'USD' | '';
  createdAt: string;
}

export interface ProfilePreferences {
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

export interface ProfileHistoryItem {
  id: string;
  type: 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'REVIEW' | 'PAYMENT';
  title: string;
  occurredAt: string;
  meta?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  phoneVerified: boolean;
  fullName: string;
  displayName?: string;
  documentNumber?: string;
  bio?: string;
  avatar?: string;
  status: string;
  role: string;
  roles: string[];
  emailVerified: boolean;
  address: ProfileAddress;
  locationLabel?: string;
  photos: ProfilePhoto[];
  payoutMethods: ProfilePayoutMethod[];
  wallet: {
    status: string;
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
  roleRatings?: {
    buyer: { average: number; count: number; weightedAverage?: number };
    seller: { average: number; count: number; weightedAverage?: number };
    agent: { average: number; count: number; weightedAverage?: number };
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
  history: ProfileHistoryItem[];
  preferences: ProfilePreferences;
  kyc: { status: string; verifiedAt?: string; rejectionReason?: string };
  identityVerified?: boolean;
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

export type ProfileUpdatePayload = {
  fullName?: string;
  displayName?: string | null;
  documentNumber?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatar?: string | null;
  address?: ProfileAddress | null;
  locationLabel?: string | null;
  photos?: Array<{
    url: string;
    kind?: UserPhotoKind;
    isPrimary?: boolean;
  }>;
  /** Al enviar documentos KYC (frente, dorso, selfie), marca identidad en revisión. */
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
    notifications: Partial<ProfilePreferences['notifications']>;
    privacy: Partial<ProfilePreferences['privacy']>;
  }>;
};
