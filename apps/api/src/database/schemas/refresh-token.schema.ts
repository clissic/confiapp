import { Schema } from 'mongoose';
import type { IRefreshToken } from '@confiapp/database';

export const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: { type: Date },
    replacedByTokenHash: { type: String },
    userAgent: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'refresh_tokens',
  },
);

// TTL: Mongo elimina docs cuando expiresAt pasa (aunque estén revoked).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });
