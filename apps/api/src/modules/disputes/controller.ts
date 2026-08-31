import type { Request, Response } from 'express';

import { DisputeCategory, DisputeStatus, PlatformRole } from '@confiapp/database';

import { ForbiddenError } from '../../shared/errors/app-error';

import { DisputesService } from './service';

export class DisputesController {
  constructor(private readonly service = new DisputesService()) {}

  getStatus = async (_req: Request, res: Response): Promise<void> => {
    const payload = await this.service.getStatus();
    res.status(200).json(payload);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== PlatformRole.ADMIN) {
      throw new ForbiddenError('Se requiere rol ADMIN');
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const statusRaw = req.query.status ? String(req.query.status) : undefined;
    const status =
      statusRaw && Object.values(DisputeStatus).includes(statusRaw as DisputeStatus)
        ? (statusRaw as DisputeStatus)
        : undefined;

    const data = await this.service.listAdmin({ page, limit, status });
    res.status(200).json(data);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== PlatformRole.ADMIN) {
      throw new ForbiddenError('Se requiere rol ADMIN');
    }
    const data = await this.service.getDetail(String(req.params.disputeId));
    res.status(200).json(data);
  };

  open = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { reason?: string; category?: DisputeCategory };
    const data = await this.service.openDispute({
      userId: req.user!.id,
      transactionCode: String(req.params.code),
      reason: String(body.reason ?? 'Disputa abierta'),
      category: body.category,
    });
    res.status(201).json(data);
  };

  resolve = async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== PlatformRole.ADMIN) {
      throw new ForbiddenError('Se requiere rol ADMIN');
    }
    const body = req.body as {
      outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND';
      notes?: string;
    };
    const data = await this.service.resolveDispute({
      adminId: req.user!.id,
      disputeId: String(req.params.disputeId),
      outcome: body.outcome,
      notes: body.notes,
    });
    res.status(200).json(data);
  };
}
