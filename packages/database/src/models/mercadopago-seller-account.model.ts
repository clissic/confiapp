import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IMercadoPagoSellerAccount } from '../interfaces/mercadopago-seller-account.interface';
import { MercadoPagoConnectionStatus } from '../types/enums';

export type MercadoPagoSellerAccountDocument = HydratedDocument<IMercadoPagoSellerAccount>;

const mercadoPagoSellerAccountSchema = new Schema<IMercadoPagoSellerAccount>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mpUserId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    publicNickname: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, maxlength: 254, lowercase: true },
    accessTokenEnc: { type: String, required: true, maxlength: 4000 },
    refreshTokenEnc: { type: String, maxlength: 4000 },
    tokenExpiresAt: { type: Date },
    scope: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: Object.values(MercadoPagoConnectionStatus),
      required: true,
      default: MercadoPagoConnectionStatus.CONNECTED,
      index: true,
    },
    connectedAt: { type: Date },
    lastError: { type: String, trim: true, maxlength: 500 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'mercadopago_seller_accounts' },
);

mercadoPagoSellerAccountSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
mercadoPagoSellerAccountSchema.index(
  { mpUserId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export const MercadoPagoSellerAccountModel: Model<IMercadoPagoSellerAccount> =
  model<IMercadoPagoSellerAccount>(
    'MercadoPagoSellerAccount',
    mercadoPagoSellerAccountSchema,
  );
