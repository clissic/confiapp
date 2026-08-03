import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IProduct } from '../interfaces/product.interface';
import {
  ProductCategory,
  ProductCondition,
  ProductStatus,
} from '../types/enums';

export type ProductDocument = HydratedDocument<IProduct>;

const productImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    storageKey: { type: String, trim: true, maxlength: 512 },
    alt: { type: String, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10_000 },
    category: {
      type: String,
      enum: Object.values(ProductCategory),
      required: true,
      index: true,
    },
    condition: {
      type: String,
      enum: Object.values(ProductCondition),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.DRAFT,
      index: true,
    },
    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 20,
        message: 'Máximo 20 imágenes por producto',
      },
    },
    estimatedValueCents: { type: Number, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: 'UYU',
      match: [/^[A-Z]{3}$/, 'currency must be ISO 4217'],
    },
    activeTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    locationLabel: { type: String, trim: true, maxlength: 200 },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'products',
  },
);

productSchema.index({ owner: 1, status: 1 });
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ title: 'text', description: 'text' });

export const ProductModel: Model<IProduct> = model<IProduct>('Product', productSchema);
