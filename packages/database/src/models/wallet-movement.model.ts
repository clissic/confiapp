import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IWalletMovement } from '../interfaces/wallet-movement.interface';
import { WalletMovementDirection, WalletMovementType } from '../types/enums';

export type WalletMovementDocument = HydratedDocument<IWalletMovement>;

const balanceSnapshotSchema = new Schema(
  {
    availableCents: { type: Number, required: true },
    pendingCents: { type: Number, required: true },
    heldCents: { type: Number, required: true },
  },
  { _id: false },
);

const walletMovementSchema = new Schema<IWalletMovement>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(WalletMovementType),
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: Object.values(WalletMovementDirection),
      required: true,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amountCents must be integer' },
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    balanceAfter: { type: balanceSnapshotSchema },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    transaction: { type: Schema.Types.ObjectId, ref: 'Transaction', index: true },
    withdrawal: { type: Schema.Types.ObjectId, ref: 'Withdrawal', index: true },
    agentCommission: { type: Schema.Types.ObjectId, ref: 'AgentCommission', index: true },
    agentPayout: { type: Schema.Types.ObjectId, ref: 'AgentPayout', index: true },
    payoutBatch: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', index: true },
    metadata: { type: Schema.Types.Mixed },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'wallet_movements' },
);

walletMovementSchema.index({ user: 1, createdAt: -1 });
walletMovementSchema.index({ user: 1, type: 1, createdAt: -1 });

export const WalletMovementModel: Model<IWalletMovement> = model<IWalletMovement>(
  'WalletMovement',
  walletMovementSchema,
);
