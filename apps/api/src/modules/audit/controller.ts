import type { Request, Response } from 'express';

import { auditService } from './service';
import type { AuditListQuery } from './validation';

export class AuditController {
  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AuditListQuery;
    // Scope forense: siempre el usuario actual (mine=false + actorId reservado a admin futuro).
    const actorId = req.user!.id;
    const data = await auditService.list({
      actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      limit: query.limit,
      before: query.before,
    });
    res.status(200).json(data);
  };
}
