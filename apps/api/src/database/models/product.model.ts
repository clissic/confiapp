import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IProduct } from '@confiapp/database';

import { applyProductIndexes } from '../indexes/product.indexes';
import { productSchema } from '../schemas/product.schema';

export type ProductDocument = HydratedDocument<IProduct>;

applyProductIndexes(productSchema);

export const ProductModel: Model<IProduct> =
  (models.Product as Model<IProduct> | undefined) ??
  model<IProduct>('Product', productSchema);
