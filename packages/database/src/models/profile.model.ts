import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IProfile } from '../interfaces/profile.interface';

export type ProfileDocument = HydratedDocument<IProfile>;

const profileSchema = new Schema<IProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 32 },
    avatarUrl: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'profiles',
  },
);

profileSchema.index({ displayName: 'text' });
profileSchema.index({ createdAt: -1 });

export const ProfileModel: Model<IProfile> = model<IProfile>('Profile', profileSchema);
