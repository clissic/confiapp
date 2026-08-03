import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IRefreshToken } from '@confiapp/database';

import { refreshTokenSchema } from '../schemas/refresh-token.schema';

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;

export const RefreshTokenModel: Model<IRefreshToken> =
  (models.RefreshToken as Model<IRefreshToken> | undefined) ??
  model<IRefreshToken>('RefreshToken', refreshTokenSchema);
