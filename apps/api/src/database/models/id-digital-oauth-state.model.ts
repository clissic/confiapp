import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

export type IdDigitalPurpose = 'agent_onboarding' | 'accept_job';

export interface IIdDigitalOAuthState {
  state: string;
  user: Types.ObjectId;
  purpose: IdDigitalPurpose;
  /** job:{CODE} | offer:{notificationId} */
  ref?: string;
  nonce: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IdDigitalOAuthStateDocument = HydratedDocument<IIdDigitalOAuthState>;

const idDigitalOAuthStateSchema = new Schema<IIdDigitalOAuthState>(
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
    purpose: {
      type: String,
      enum: ['agent_onboarding', 'accept_job'],
      required: true,
    },
    ref: { type: String, trim: true, maxlength: 128 },
    nonce: { type: String, required: true, maxlength: 128 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'id_digital_oauth_states' },
);

idDigitalOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdDigitalOAuthStateModel: Model<IIdDigitalOAuthState> =
  (models.IdDigitalOAuthState as Model<IIdDigitalOAuthState> | undefined) ??
  model<IIdDigitalOAuthState>('IdDigitalOAuthState', idDigitalOAuthStateSchema);
