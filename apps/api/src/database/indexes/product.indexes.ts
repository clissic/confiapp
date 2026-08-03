import type { Schema } from 'mongoose';
import type { IProduct } from '@confiapp/database';

export function applyProductIndexes(schema: Schema<IProduct>): void {
  schema.index({ owner: 1 });
  schema.index({ status: 1 });
  schema.index({ category: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ owner: 1, status: 1 });
  schema.index({ status: 1, category: 1, createdAt: -1 });
  schema.index({ title: 'text', description: 'text' });
}
