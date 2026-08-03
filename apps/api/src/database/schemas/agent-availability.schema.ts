import { Schema } from 'mongoose';
import { DayOfWeek, type IAgentAvailability } from '@confiapp/database';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const slotSchema = new Schema(
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

const exceptionSchema = new Schema(
  {
    date: { type: Date, required: true },
    isAvailable: { type: Boolean, required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

export const agentAvailabilitySchema = new Schema<IAgentAvailability>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user is required'],
      unique: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      default: 'America/Argentina/Buenos_Aires',
    },
    isAcceptingAssignments: { type: Boolean, default: true },
    maxActiveTransactions: {
      type: Number,
      default: 5,
      min: [1, 'maxActiveTransactions min is 1'],
      max: [100, 'maxActiveTransactions max is 100'],
    },
    weeklySlots: {
      type: [slotSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 70,
        message: 'Demasiadas franjas semanales',
      },
    },
    exceptions: {
      type: [exceptionSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 366,
        message: 'Demasiadas excepciones',
      },
    },
    coverageLabel: { type: String, trim: true, maxlength: 200 },
    coverageRadiusKm: { type: Number, min: 0, max: 20_000 },
    hourlyRateCents: {
      type: Number,
      min: 0,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || Number.isInteger(value),
        message: 'hourlyRateCents must be an integer',
      },
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    termsAcceptedAt: { type: Date },
    termsVersion: { type: String, trim: true, maxlength: 32 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'agent_availability' },
);

agentAvailabilitySchema.pre('validate', function (next) {
  for (const slot of this.weeklySlots ?? []) {
    if (slot.startTime >= slot.endTime) {
      next(new Error('startTime must be before endTime'));
      return;
    }
  }
  next();
});
