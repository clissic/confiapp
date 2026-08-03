import { Schema } from 'mongoose';
import { AuditAction, AuditOutcome, type IAuditLog } from '@confiapp/database';

/** Append-only: sin updatedAt ni deletedAt. */
export const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, trim: true, maxlength: 64 },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
    },
    entityType: { type: String, required: true, trim: true, maxlength: 64 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    outcome: {
      type: String,
      enum: Object.values(AuditOutcome),
    },
    correlationId: { type: String, trim: true, maxlength: 128 },
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
