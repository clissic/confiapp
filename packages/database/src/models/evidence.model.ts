import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IEvidence } from '../interfaces/evidence.interface';
import { EvidenceStatus, EvidenceType } from '../types/enums';

export type EvidenceDocument = HydratedDocument<IEvidence>;

const evidenceSchema = new Schema<IEvidence>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(EvidenceType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(EvidenceStatus),
      default: EvidenceStatus.SUBMITTED,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    storageKey: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true },
    sizeBytes: { type: Number, min: 0 },
    checksum: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'evidence',
  },
);

evidenceSchema.index({ transaction: 1, createdAt: -1 });
evidenceSchema.index({ transaction: 1, status: 1 });

export const EvidenceModel: Model<IEvidence> = model<IEvidence>('Evidence', evidenceSchema);
