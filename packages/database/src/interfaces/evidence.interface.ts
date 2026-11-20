import type { Types } from 'mongoose';

import type { EvidenceKind, EvidenceStatus, EvidenceType } from '../types/enums';

export interface IEvidence {
  transaction: Types.ObjectId;
  /** Disputa a la que pertenece el expediente (si aplica). */
  dispute?: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  type: EvidenceType;
  /** Clasificación del ítem dentro del expediente. */
  kind?: EvidenceKind;
  status: EvidenceStatus;
  title: string;
  description?: string;
  /**
   * Clave de objeto (fotos) o sentinel `snapshot://…` para payloads JSON.
   * Opcional si hay `payload`.
   */
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  /** Snapshot estructurado (participantes, chat, etc.). */
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
