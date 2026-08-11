import { Schema } from 'mongoose';
import {
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
  type IUser,
} from '@confiapp/database';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const kycSchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(IdentityVerificationStatus),
      default: IdentityVerificationStatus.UNVERIFIED,
    },
    provider: { type: String, trim: true, maxlength: 64 },
    externalId: { type: String, trim: true, maxlength: 128 },
    documentType: { type: String, trim: true, maxlength: 64 },
    documentNumberHash: { type: String, select: false, maxlength: 128 },
    verifiedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    notes: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewTokenHash: { type: String, select: false, maxlength: 128 },
    reviewTokenExpiresAt: { type: Date, select: false },
  },
  { _id: false },
);

const reputationSchema = new Schema(
  {
    score: { type: Number, default: 0, min: 0, max: 100 },
    completedTransactions: { type: Number, default: 0, min: 0 },
    cancelledTransactions: { type: Number, default: 0, min: 0 },
    disputedTransactions: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const walletSchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(WalletStatus),
      default: WalletStatus.ACTIVE,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: 'UYU',
      match: [/^[A-Z]{3}$/, 'currency must be ISO 4217'],
    },
    availableCents: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'availableCents must be integer' },
    },
    pendingCents: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'pendingCents must be integer' },
    },
    heldCents: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'heldCents must be integer' },
    },
    lifetimeEarnedCents: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'lifetimeEarnedCents must be integer' },
    },
    lifetimeSpentCents: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'lifetimeSpentCents must be integer' },
    },
    lastMovementAt: { type: Date },
    providerCustomerId: { type: String, trim: true, maxlength: 128 },
  },
  { _id: false },
);

const ratingDistributionSchema = new Schema(
  {
    one: { type: Number, default: 0, min: 0 },
    two: { type: Number, default: 0, min: 0 },
    three: { type: Number, default: 0, min: 0 },
    four: { type: Number, default: 0, min: 0 },
    five: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const ratingSchema = new Schema(
  {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 },
    sum: { type: Number, default: 0, min: 0 },
    weightedSum: { type: Number, default: 0, min: 0 },
    weightTotal: { type: Number, default: 0, min: 0 },
    weightedAverage: { type: Number, default: 0, min: 0, max: 5 },
    distribution: {
      type: ratingDistributionSchema,
      default: () => ({ one: 0, two: 0, three: 0, four: 0, five: 0 }),
    },
  },
  { _id: false },
);

const emptyRatingDefault = () => ({
  average: 0,
  count: 0,
  sum: 0,
  weightedSum: 0,
  weightTotal: 0,
  weightedAverage: 0,
  distribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
});

const roleRatingsSchema = new Schema(
  {
    buyer: { type: ratingSchema, default: emptyRatingDefault },
    seller: { type: ratingSchema, default: emptyRatingDefault },
    agent: { type: ratingSchema, default: emptyRatingDefault },
  },
  { _id: false },
);

const statsSchema = new Schema(
  {
    completedTransactions: { type: Number, default: 0, min: 0 },
    cancelledTransactions: { type: Number, default: 0, min: 0 },
    disputedTransactions: { type: Number, default: 0, min: 0 },
    asCreatorCount: { type: Number, default: 0, min: 0 },
    asCounterpartyCount: { type: Number, default: 0, min: 0 },
    asAgentCount: { type: Number, default: 0, min: 0 },
    totalVolumeCents: { type: Number, default: 0, min: 0 },
    averageResponseMinutes: { type: Number, default: 0, min: 0 },
    reviewsGiven: { type: Number, default: 0, min: 0 },
    reviewsReceived: { type: Number, default: 0, min: 0 },
    messagesSent: { type: Number, default: 0, min: 0 },
    successRate: { type: Number, default: 0, min: 0, max: 100 },
    lastActiveAt: { type: Date },
  },
  { _id: false },
);

const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) =>
          Array.isArray(value) &&
          value.length === 2 &&
          value[0]! >= -180 &&
          value[0]! <= 180 &&
          value[1]! >= -90 &&
          value[1]! <= 90,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    country: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 2,
      match: [/^[A-Z]{2}$/, 'country must be ISO 3166-1 alpha-2'],
    },
    postalCode: { type: String, trim: true, maxlength: 32 },
    formatted: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const locationSchema = new Schema(
  {
    point: { type: geoPointSchema },
    address: { type: addressSchema, default: () => ({}) },
    label: { type: String, trim: true, maxlength: 200 },
    coverageRadiusKm: { type: Number, min: 0, max: 20_000 },
    updatedAt: { type: Date },
  },
  { _id: false },
);

const scheduleSlotSchema = new Schema(
  {
    dayOfWeek: {
      type: String,
      enum: Object.values(DayOfWeek),
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [TIME_RE, 'startTime must be HH:mm'],
    },
    endTime: {
      type: String,
      required: true,
      match: [TIME_RE, 'endTime must be HH:mm'],
    },
  },
  { _id: false },
);

const scheduleExceptionSchema = new Schema(
  {
    date: { type: Date, required: true },
    isAvailable: { type: Boolean, required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const scheduleSchema = new Schema(
  {
    timezone: {
      type: String,
      trim: true,
      maxlength: 64,
      default: 'America/Argentina/Buenos_Aires',
    },
    isAcceptingAssignments: { type: Boolean, default: false },
    maxActiveTransactions: { type: Number, default: 5, min: 1, max: 100 },
    unspecifiedSchedule: { type: Boolean, default: false },
    weeklySlots: {
      type: [scheduleSlotSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 70,
        message: 'Too many weekly slots',
      },
    },
    exceptions: {
      type: [scheduleExceptionSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 366,
        message: 'Too many schedule exceptions',
      },
    },
  },
  { _id: false },
);

const photoSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 4_000_000 },
    storageKey: { type: String, trim: true, maxlength: 512 },
    kind: {
      type: String,
      enum: Object.values(UserPhotoKind),
      default: UserPhotoKind.PROFILE,
    },
    mimeType: { type: String, trim: true, maxlength: 128 },
    sizeBytes: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    isPrimary: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
  },
  { _id: false },
);

const payoutMethodSchema = new Schema(
  {
    bank: { type: String, required: true, trim: true, maxlength: 64 },
    number: { type: String, required: true, trim: true, maxlength: 32 },
    type: {
      type: String,
      enum: ['CA', 'CC', 'FINTECH'],
      required: true,
    },
    currency: {
      type: String,
      enum: ['', 'UYU', 'USD'],
      default: '',
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const channelVerificationSchema = new Schema(
  {
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  { _id: false },
);

const subVerificationStatusSchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(AddressVerificationStatus),
      default: AddressVerificationStatus.UNVERIFIED,
    },
    verifiedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const verificationSchema = new Schema(
  {
    email: {
      type: channelVerificationSchema,
      default: () => ({ verified: false }),
    },
    phone: {
      type: channelVerificationSchema,
      default: () => ({ verified: false }),
    },
    identity: {
      type: kycSchema,
      default: () => ({ status: IdentityVerificationStatus.UNVERIFIED }),
    },
    address: {
      type: subVerificationStatusSchema,
      default: () => ({ status: AddressVerificationStatus.UNVERIFIED }),
    },
    photo: {
      type: subVerificationStatusSchema,
      default: () => ({ status: AddressVerificationStatus.UNVERIFIED }),
    },
  },
  { _id: false },
);

const notificationPreferencesSchema = new Schema(
  {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
    transactionUpdates: { type: Boolean, default: true },
    messageAlerts: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true },
    disputeAlerts: { type: Boolean, default: true },
  },
  { _id: false },
);

const privacyPreferencesSchema = new Schema(
  {
    showLocation: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    showEmail: { type: Boolean, default: false },
    showRating: { type: Boolean, default: true },
    profileVisibility: {
      type: String,
      enum: Object.values(ProfileVisibility),
      default: ProfileVisibility.PUBLIC,
    },
  },
  { _id: false },
);

const preferencesSchema = new Schema(
  {
    language: { type: String, trim: true, maxlength: 16, default: 'es' },
    locale: { type: String, trim: true, maxlength: 16, default: 'es-AR' },
    timezone: {
      type: String,
      trim: true,
      maxlength: 64,
      default: 'America/Argentina/Buenos_Aires',
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: 'USD',
      match: [/^[A-Z]{3}$/, 'currency must be ISO 4217'],
    },
    theme: {
      type: String,
      enum: Object.values(ThemePreference),
      default: ThemePreference.SYSTEM,
    },
    distanceUnit: {
      type: String,
      enum: Object.values(DistanceUnit),
      default: DistanceUnit.KM,
    },
    notifications: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    privacy: {
      type: privacyPreferencesSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const adminProfileSchema = new Schema(
  {
    permissions: {
      type: [{ type: String, trim: true, maxlength: 64 }],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 100,
        message: 'Too many permissions',
      },
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    lastAdminActionAt: { type: Date },
  },
  { _id: false },
);

export const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [320, 'Email is too long'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [32, 'Phone is too long'],
      validate: {
        validator: (value: string | undefined | null) =>
          value == null || value === '' || /^\+?[0-9\s()-]{7,32}$/.test(value),
        message: 'Invalid phone format',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name is too short'],
      maxlength: [120, 'Full name is too long'],
    },
    displayName: { type: String, trim: true, maxlength: 120 },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    bio: { type: String, trim: true, maxlength: 2000 },
    dateOfBirth: { type: Date },
    avatar: {
      type: String,
      trim: true,
      maxlength: [2_000_000, 'Avatar URL is too long'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(UserStatus),
        message: 'Invalid user status',
      },
      default: UserStatus.ACTIVE,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(PlatformRole),
        message: 'Invalid role (USER | AGENT | ADMIN)',
      },
      default: PlatformRole.USER,
      index: true,
    },
    roles: {
      type: [
        {
          type: String,
          enum: Object.values(PlatformRole),
        },
      ],
      default: () => [PlatformRole.USER],
      validate: {
        validator: (value: PlatformRole[]) =>
          Array.isArray(value) && value.length >= 1 && value.length <= 3,
        message: 'roles must contain 1–3 values: USER, AGENT, ADMIN',
      },
    },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockUntil: { type: Date, select: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    wallet: {
      type: walletSchema,
      default: () => ({
        status: WalletStatus.ACTIVE,
        currency: 'UYU',
        availableCents: 0,
        pendingCents: 0,
        heldCents: 0,
        lifetimeEarnedCents: 0,
        lifetimeSpentCents: 0,
      }),
    },
    rating: {
      type: ratingSchema,
      default: emptyRatingDefault,
    },
    roleRatings: {
      type: roleRatingsSchema,
      default: () => ({
        buyer: emptyRatingDefault(),
        seller: emptyRatingDefault(),
        agent: emptyRatingDefault(),
      }),
    },
    stats: {
      type: statsSchema,
      default: () => ({
        completedTransactions: 0,
        cancelledTransactions: 0,
        disputedTransactions: 0,
        asCreatorCount: 0,
        asCounterpartyCount: 0,
        asAgentCount: 0,
        totalVolumeCents: 0,
        averageResponseMinutes: 0,
        reviewsGiven: 0,
        reviewsReceived: 0,
        messagesSent: 0,
        successRate: 0,
      }),
    },
    reputation: {
      type: reputationSchema,
      default: () => ({
        score: 0,
        completedTransactions: 0,
        cancelledTransactions: 0,
        disputedTransactions: 0,
      }),
    },
    location: {
      type: locationSchema,
      default: () => ({ address: {} }),
    },
    schedule: {
      type: scheduleSchema,
      default: () => ({
        timezone: 'America/Argentina/Buenos_Aires',
        isAcceptingAssignments: false,
        maxActiveTransactions: 5,
        weeklySlots: [],
        exceptions: [],
      }),
    },
    photos: {
      type: [photoSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 30,
        message: 'Máximo 30 fotografías',
      },
    },
    payoutMethods: {
      type: [payoutMethodSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 20,
        message: 'Máximo 20 métodos de cobro',
      },
    },
    verification: {
      type: verificationSchema,
      default: () => ({
        email: { verified: false },
        phone: { verified: false },
        identity: { status: IdentityVerificationStatus.UNVERIFIED },
        address: { status: AddressVerificationStatus.UNVERIFIED },
        photo: { status: AddressVerificationStatus.UNVERIFIED },
      }),
    },
    kyc: {
      type: kycSchema,
      default: () => ({ status: IdentityVerificationStatus.UNVERIFIED }),
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
    agent: {
      type: new Schema(
        {
          status: {
            type: String,
            enum: Object.values(AgentOnboardingStatus),
            default: AgentOnboardingStatus.NONE,
          },
          termsAccepted: { type: Boolean, default: false },
          termsAcceptedAt: { type: Date },
          termsVersion: { type: String, trim: true, maxlength: 32 },
          workAreaLabel: { type: String, trim: true, maxlength: 200 },
          workAreaCity: { type: String, trim: true, maxlength: 120 },
          workAreaCountry: {
            type: String,
            trim: true,
            uppercase: true,
            maxlength: 2,
          },
          coverageRadiusKm: { type: Number, min: 1, max: 500 },
          hourlyRateCents: { type: Number, min: 0 },
          ratesAccepted: { type: Boolean, default: false },
          ratesAcceptedAt: { type: Date },
          currency: {
            type: String,
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
            default: 'USD',
          },
          draftStep: { type: Number, default: 1, min: 1, max: 5 },
          submittedAt: { type: Date },
          activatedAt: { type: Date },
        },
        { _id: false },
      ),
      default: () => ({
        status: AgentOnboardingStatus.NONE,
        termsAccepted: false,
        ratesAccepted: false,
        currency: 'USD',
        draftStep: 1,
      }),
    },
    admin: { type: adminProfileSchema },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        Reflect.deleteProperty(ret, 'passwordHash');
        Reflect.deleteProperty(ret, 'emailVerificationTokenHash');
        Reflect.deleteProperty(ret, 'passwordResetTokenHash');
        Reflect.deleteProperty(ret, 'lockUntil');
        Reflect.deleteProperty(ret, '__v');
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        Reflect.deleteProperty(ret, 'passwordHash');
        Reflect.deleteProperty(ret, 'emailVerificationTokenHash');
        Reflect.deleteProperty(ret, 'passwordResetTokenHash');
        Reflect.deleteProperty(ret, 'lockUntil');
        Reflect.deleteProperty(ret, '__v');
        return ret;
      },
    },
  },
);

userSchema.pre('validate', function (next) {
  if (!this.roles?.length) {
    this.roles = [this.role ?? PlatformRole.USER];
  }
  if (this.role && !this.roles.includes(this.role)) {
    this.roles = [...this.roles, this.role];
  }
  for (const slot of this.schedule?.weeklySlots ?? []) {
    if (slot.startTime >= slot.endTime) {
      next(new Error('schedule slot startTime must be before endTime'));
      return;
    }
  }
  next();
});
