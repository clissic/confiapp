import type { Request, Response } from 'express';

import { PlatformRole } from '@confiapp/database';

import { ForbiddenError } from '../../shared/errors/app-error';

import { auditService } from './service';
import type { AuditListQuery } from './validation';

export class AuditController {
  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AuditListQuery;
    const isAdmin = req.user?.role === PlatformRole.ADMIN;

    // Usuarios: solo su propio historial. Admin: forense global o filtrado.
    if (!isAdmin) {
      if (query.actorId && query.actorId !== req.user!.id) {
        throw new ForbiddenError('No podés auditar a otros usuarios');
      }
      const data = await auditService.list({
        actorId: req.user!.id,
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action,
        limit: query.limit,
        page: query.page,
        before: query.before,
      });
      res.status(200).json(data);
      return;
    }

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
