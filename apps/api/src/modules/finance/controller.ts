import type { Request, Response } from 'express';

import { PlatformRole } from '@confiapp/database';

import { ForbiddenError } from '../../shared/errors/app-error';
import { agentCommissionService } from './commission.service';
import { financialAudit } from './financial-audit.service';
import { payoutService } from './payout.service';
import { financeReconcileService } from './reconcile.service';

function requireAdmin(req: Request): void {
  if (req.user?.role !== PlatformRole.ADMIN) {
    throw new ForbiddenError('Se requiere rol ADMIN');
  }
}

export class FinanceController {
  agentBalances = async (req: Request, res: Response): Promise<void> => {
    const agentId = String(req.params.agentId || req.user!.id);
    const isAdmin = req.user?.role === PlatformRole.ADMIN;
    if (!isAdmin && agentId !== req.user!.id) {
      throw new ForbiddenError('No podés ver el saldo de otro agente');
    }
    const balances = await agentCommissionService.getAgentBalances(agentId);
    const commissions = await agentCommissionService.listForAgent(agentId);
    res.status(200).json({ balances, commissions });
  };

  myAgentWallet = async (req: Request, res: Response): Promise<void> => {
    const agentId = req.user!.id;
    const balances = await agentCommissionService.getAgentBalances(agentId);
    const commissions = await agentCommissionService.listForAgent(agentId);
    const payouts = await payoutService.listPayoutsForAgent(agentId, agentId, false);
    res.status(200).json({ balances, commissions, payouts });
  };

  releaseDueCommissions = async (req: Request, res: Response): Promise<void> => {
    const result = await agentCommissionService.releaseDue();
    res.status(200).json(result);
  };

  createBatch = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const body = req.body as {
      agentIds?: string[];
      notes?: string;
      allowOutsideWindow?: boolean;
    };
    const data = await payoutService.createBatchFromAvailable({
      adminId: req.user!.id,
      agentIds: body.agentIds,
      notes: body.notes,
      allowOutsideWindow: body.allowOutsideWindow,
    });
    res.status(201).json(data);
  };

  listBatches = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const data = await payoutService.listBatches(
      req.query.limit ? Number(req.query.limit) : 40,
    );
    res.status(200).json({ items: data });
  };

  getBatch = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const data = await payoutService.getBatch(String(req.params.batchId));
    res.status(200).json(data);
  };

  confirmPayout = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const body = req.body as {
      transferReference: string;
      transferDate?: string;
      paymentMethod?: string;
      proofUrl?: string;
      notes?: string;
    };
    const data = await payoutService.confirmPayout({
      adminId: req.user!.id,
      payoutId: String(req.params.payoutId),
      transferReference: body.transferReference,
      transferDate: body.transferDate,
      paymentMethod: body.paymentMethod,
      proofUrl: body.proofUrl,
      notes: body.notes,
    });
    res.status(200).json(data);
  };

  reconcileOperation = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const data = await financeReconcileService.reconcileOperation(
      String(req.params.operationId),
    );
    res.status(200).json(data);
  };

  reconcileAgent = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const data = await financeReconcileService.reconcileAgent(
      String(req.params.agentId),
    );
    res.status(200).json(data);
  };

  listAudit = async (req: Request, res: Response): Promise<void> => {
    requireAdmin(req);
    const data = await financialAudit.list({
      operationId: req.query.operationId
        ? String(req.query.operationId)
        : undefined,
      agentId: req.query.agentId ? String(req.query.agentId) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 15,
      page: req.query.page ? Number(req.query.page) : 1,
    });
    res.status(200).json(data);
  };
}
