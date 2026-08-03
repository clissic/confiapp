import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

import type { IAuditLog } from '../interfaces/audit-log.interface';
import { AuditAction, AuditOutcome } from '../types/enums';

export type AuditLogDocument = HydratedDocument<IAuditLog>;

/**
 * Append-only: no updatedAt / deletedAt.
 * Permite reconstruir la historia completa de cualquier entidad.
 */
const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String, trim: true, maxlength: 64 },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    entityType: { type: String, required: true, trim: true, maxlength: 64, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    outcome: {
      type: String,
      enum: Object.values(AuditOutcome),
      index: true,
    },
    correlationId: { type: String, trim: true, maxlength: 128, index: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 512 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
    versionKey: false,
  },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ correlationId: 1, createdAt: -1 });

export const AuditLogModel: Model<IAuditLog> = model<IAuditLog>('AuditLog', auditLogSchema);
