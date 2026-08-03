import { model, models, type HydratedDocument, type Model } from 'mongoose';
import { PlatformRole, UserStatus, type IUser } from '@confiapp/database';

import { applyUserIndexes } from '../indexes/user.indexes';
import { userSchema } from '../schemas/user.schema';

export type UserDocument = HydratedDocument<IUser>;

applyUserIndexes(userSchema);

userSchema.virtual('isActive').get(function (this: UserDocument) {
  return this.status === UserStatus.ACTIVE && !this.deletedAt;
});

userSchema.virtual('isAgent').get(function (this: UserDocument) {
  return this.role === PlatformRole.AGENT || this.roles?.includes(PlatformRole.AGENT);
});

userSchema.virtual('isAdmin').get(function (this: UserDocument) {
  return this.role === PlatformRole.ADMIN || this.roles?.includes(PlatformRole.ADMIN);
});

export const UserModel: Model<IUser> =
  (models.User as Model<IUser> | undefined) ?? model<IUser>('User', userSchema);
