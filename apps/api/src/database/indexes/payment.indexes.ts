import type { Schema } from 'mongoose';
import type { IPayment } from '@confiapp/database';

export function applyPaymentIndexes(schema: Schema<IPayment>): void {
  schema.index({ transaction: 1 });
  schema.index({ payer: 1 });
  schema.index({ type: 1 });
  schema.index({ status: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ idempotencyKey: 1 }, { unique: true });
  schema.index({ transaction: 1, status: 1, createdAt: -1 });
  schema.index({ externalId: 1 }, { sparse: true });
  schema.index({ payer: 1, createdAt: -1 });
  schema.index({ payee: 1, createdAt: -1 });
  schema.index({ payee: 1, type: 1, createdAt: -1 });
}
