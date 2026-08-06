import { Schema } from 'mongoose';
import {
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  TransactionStatus,
  type ITransaction,
} from '@confiapp/database';

const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: Object.values(ParticipantRole),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ParticipantStatus),
      default: ParticipantStatus.INVITED,
    },
    invitedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
  },
  { _id: false },
);

const conditionsSchema = new Schema(
  {
    summary: { type: String, required: true, trim: true, maxlength: 5000 },
    /** Items { id, text, done } — Mixed por compat con string[] legacy. */
    checklist: { type: [Schema.Types.Mixed], default: undefined },
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

export const transactionSchema = new Schema<ITransaction>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    initiatedBy: {
      type: String,
      enum: Object.values(TransactionInitiator),
      default: TransactionInitiator.BUYER,
    },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    meetingLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
      },
      label: { type: String, trim: true, maxlength: 200 },
    },
    chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
    participants: {
      type: [participantSchema],
      validate: {
        validator: (value: unknown[]) =>
          Array.isArray(value) && value.length >= 1 && value.length <= 3,
        message: 'Una operación debe tener entre 1 y 3 participantes',
      },
    },
    conditions: {
      type: conditionsSchema,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.CREATED,
    },
    statusHistory: {
      type: [statusEventSchema],
      default: [],
    },
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
    amountCents: {
      type: Number,
      min: 0,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || Number.isInteger(value),
        message: 'amountCents must be an integer',
      },
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      match: [/^[A-Z]{3}$/, 'currency must be ISO 4217'],
    },
    inviteTokenHash: {
      type: String,
      select: false,
      unique: true,
      sparse: true,
    },
    inviteExpiresAt: { type: Date },
    startsAt: { type: Date },
    endsAt: { type: Date },
    fundedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    disputedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'transactions',
  },
);

transactionSchema.pre('validate', function (next) {
  if (!this.statusHistory?.length) {
    this.statusHistory = [
      {
        status: this.status ?? TransactionStatus.CREATED,
        changedAt: new Date(),
        changedBy: this.createdBy,
        note: 'Operación creada',
      },
    ];
  }
  next();
});
