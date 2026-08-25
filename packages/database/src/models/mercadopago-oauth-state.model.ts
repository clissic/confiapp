import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IMercadoPagoOAuthState } from '../interfaces/mercadopago-seller-account.interface';

export type MercadoPagoOAuthStateDocument = HydratedDocument<IMercadoPagoOAuthState>;

const mercadoPagoOAuthStateSchema = new Schema<IMercadoPagoOAuthState>(
  {
    state: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 128,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    codeVerifier: { type: String, required: true, maxlength: 128 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'mercadopago_oauth_states' },
);

mercadoPagoOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MercadoPagoOAuthStateModel: Model<IMercadoPagoOAuthState> =
  model<IMercadoPagoOAuthState>('MercadoPagoOAuthState', mercadoPagoOAuthStateSchema);
