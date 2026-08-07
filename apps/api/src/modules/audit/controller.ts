import type { Request, Response } from 'express';

import { auditService } from './service';
import type { AuditListQuery } from './validation';

export class AuditController {
  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AuditListQuery;
    // Temporal: listado global para forense / legal.
    // Luego: solo ADMIN sin actorId; usuarios normales siempre scoped a req.user.id.
    const actorId = query.mine ? req.user!.id : query.actorId;
    const data = await auditService.list({
      actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      limit: query.limit,
      page: query.page,
      before: query.before,
    });
    res.status(200).json(data);
  };
}
