import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IDispute } from '../interfaces/dispute.interface';
import { DisputeStatus } from '../types/enums';

export type DisputeDocument = HydratedDocument<IDispute>;

const disputeSchema = new Schema<IDispute>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: Object.values(DisputeStatus),
      default: DisputeStatus.OPEN,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 5000 },
    resolutionNote: { type: String, trim: true, maxlength: 5000 },
    openedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'disputes',
  },
);

disputeSchema.index({ transaction: 1, status: 1 });
disputeSchema.index({ transaction: 1, createdAt: -1 });

export const DisputeModel: Model<IDispute> = model<IDispute>('Dispute', disputeSchema);
