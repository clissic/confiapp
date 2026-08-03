import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IAuditLog } from '@confiapp/database';

import { applyAuditLogIndexes } from '../indexes/audit-log.indexes';
import { auditLogSchema } from '../schemas/audit-log.schema';

export type AuditLogDocument = HydratedDocument<IAuditLog>;

applyAuditLogIndexes(auditLogSchema);

export const AuditLogModel: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog> | undefined) ??
  model<IAuditLog>('AuditLog', auditLogSchema);
