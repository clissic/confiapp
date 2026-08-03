import { Schema } from 'mongoose';
import { EvidenceStatus, EvidenceType, type IEvidence } from '@confiapp/database';

export const evidenceSchema = new Schema<IEvidence>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(EvidenceType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(EvidenceStatus),
      default: EvidenceStatus.SUBMITTED,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    storageKey: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true },
    sizeBytes: { type: Number, min: 0 },
    checksum: { type: String, trim: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'evidence',
  },
);
