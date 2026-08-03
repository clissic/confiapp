import { Schema } from 'mongoose';
import type { IProfile } from '@confiapp/database';

export const profileSchema = new Schema<IProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 32 },
    avatarUrl: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'profiles',
  },
);
