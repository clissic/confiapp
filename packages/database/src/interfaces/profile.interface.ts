import type { Types } from 'mongoose';

export interface IProfile {
  user: Types.ObjectId;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
