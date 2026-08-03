import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IProfile } from '@confiapp/database';

import { applyProfileIndexes } from '../indexes/profile.indexes';
import { profileSchema } from '../schemas/profile.schema';

export type ProfileDocument = HydratedDocument<IProfile>;

applyProfileIndexes(profileSchema);

export const ProfileModel: Model<IProfile> =
  (models.Profile as Model<IProfile> | undefined) ?? model<IProfile>('Profile', profileSchema);
