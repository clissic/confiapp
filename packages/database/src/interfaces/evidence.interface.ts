import type { Types } from 'mongoose';

import type { EvidenceStatus, EvidenceType } from '../types/enums';

export interface IEvidence {
  transaction: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  type: EvidenceType;
  status: EvidenceStatus;
  title: string;
  description?: string;
  storageKey: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
