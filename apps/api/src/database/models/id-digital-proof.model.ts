import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

import type { IdDigitalPurpose } from './id-digital-oauth-state.model';

export interface IIdDigitalProof {
  user: Types.ObjectId;
  purpose: IdDigitalPurpose;
  ref: string;
  sub: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IdDigitalProofDocument = HydratedDocument<IIdDigitalProof>;

const idDigitalProofSchema = new Schema<IIdDigitalProof>(
  {
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
    ref: { type: String, required: true, trim: true, maxlength: 128, index: true },
    sub: { type: String, required: true, trim: true, maxlength: 128 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true, collection: 'id_digital_proofs' },
);

idDigitalProofSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdDigitalProofModel: Model<IIdDigitalProof> =
  (models.IdDigitalProof as Model<IIdDigitalProof> | undefined) ??
  model<IIdDigitalProof>('IdDigitalProof', idDigitalProofSchema);
