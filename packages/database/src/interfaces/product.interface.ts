import type { Types } from 'mongoose';

import type {
  ProductCategory,
  ProductCondition,
  ProductStatus,
} from '../types/enums';

export interface ProductImage {
  url: string;
  storageKey?: string;
  alt?: string;
  sortOrder: number;
}

/**
 * Bien o servicio sujeto a una operación de escrow.
 */
export interface IProduct {
  owner: Types.ObjectId;
  title: string;
  description?: string;
  category: ProductCategory;
  condition: ProductCondition;
  status: ProductStatus;
  images: ProductImage[];
  /** Precio estimado en centavos (referencia; el monto de escrow vive en Transaction). */
  estimatedValueCents?: number;
  currency: string;
  /** Última / actual operación vinculada. */
  activeTransaction?: Types.ObjectId;
  locationLabel?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
