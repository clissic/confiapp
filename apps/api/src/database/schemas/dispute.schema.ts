import { Schema } from 'mongoose';
import { DisputeStatus, type IDispute } from '@confiapp/database';

export const disputeSchema = new Schema<IDispute>(
  {
    transaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: Object.values(DisputeStatus),
      default: DisputeStatus.OPEN,
    },
    reason: { type: String, required: true, trim: true, maxlength: 5000 },
    resolutionNote: { type: String, trim: true, maxlength: 5000 },
    openedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'disputes',
  },
);
