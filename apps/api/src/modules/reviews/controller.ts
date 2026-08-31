import type { Request, Response } from 'express';

import { PlatformRole } from '@confiapp/database';

import { reputationService } from './service';
import type { CreateReviewBody, ReviewsListQuery } from './validation';

export class ReviewsController {
  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateReviewBody;
    const data = await reputationService.createReview(req.user!.id, body);
    res.status(201).json(data);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ReviewsListQuery;
    const userId = query.mine ? req.user!.id : query.userId;
    const isAdmin = req.user?.role === PlatformRole.ADMIN;
    const data = await reputationService.listReviews({
      userId,
      as: query.as,
      role: query.role,
      transactionCode: query.transactionCode,
      limit: query.limit,
      page: query.page,
      flaggedOnly: query.flaggedOnly,
      /** Admin viendo listado global: incluye moderación / no públicas. */
      includeNonPublic: Boolean(isAdmin && !query.mine && !query.userId),
    });
    res.status(200).json(data);
  };

  pendingTargets = async (req: Request, res: Response): Promise<void> => {
    const code = String(req.query.code ?? '');
    const data = await reputationService.listPendingTargets(req.user!.id, code);
    res.status(200).json(data);
  };

  myReputation = async (req: Request, res: Response): Promise<void> => {
    const data = await reputationService.getReputation(req.user!.id);
    res.status(200).json(data);
  };

  getReputation = async (req: Request, res: Response): Promise<void> => {
    const data = await reputationService.getReputation(String(req.params.userId));
    res.status(200).json(data);
  };
}
