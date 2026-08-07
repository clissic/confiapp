import { Schema } from 'mongoose';
import {
  ProductCategory,
  ProductCondition,
  ProductStatus,
  type IProduct,
} from '@confiapp/database';

const productImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 3_500_000 },
    storageKey: { type: String, trim: true, maxlength: 512 },
    alt: { type: String, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

export const productSchema = new Schema<IProduct>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'owner is required'],
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      maxlength: [200, 'title is too long'],
    },
    description: { type: String, trim: true, maxlength: 10_000 },
    category: {
      type: String,
      enum: {
        values: Object.values(ProductCategory),
        message: 'Invalid product category',
      },
      required: true,
    },
    condition: {
      type: String,
      enum: {
        values: Object.values(ProductCondition),
        message: 'Invalid product condition',
      },
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.DRAFT,
    },
    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length <= 20,
        message: 'Máximo 20 imágenes por producto',
      },
    },
    estimatedValueCents: {
      type: Number,
      min: [0, 'estimatedValueCents cannot be negative'],
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || Number.isInteger(value),
        message: 'estimatedValueCents must be an integer',
      },
    },
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
    activeTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    locationLabel: { type: String, trim: true, maxlength: 200 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'products' },
);
