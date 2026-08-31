import type { Types } from 'mongoose';

import type { DisputeCategory, DisputeStatus } from '../types/enums';

export interface IDispute {
  transaction: Types.ObjectId;
  openedBy: Types.ObjectId;
  /** Agente / admin asignado a mediar. */
  assignedTo?: Types.ObjectId;
  resolvedBy?: Types.ObjectId;
  status: DisputeStatus;
  category?: DisputeCategory;
  reason: string;
  resolutionNote?: string;
  openedAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
