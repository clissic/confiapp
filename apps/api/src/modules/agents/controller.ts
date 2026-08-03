import type { Request, Response } from 'express';

import { AgentAssignmentService } from './assignment.service';
import { OpenJobsService } from './open-jobs.service';
import { AgentsService } from './service';
import type {
  AgentSearchQuery,
  OfferAssignmentBody,
  OpenJobsQuery,
  SaveAgentOnboardingBody,
  SubmitAgentOnboardingBody,
} from './validation';

export class AgentsController {
  constructor(
    private readonly service = new AgentsService(),
    private readonly assignments = new AgentAssignmentService(),
    private readonly openJobs = new OpenJobsService(),
  ) {}

  getOnboarding = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.getOnboarding(req.user!.id);
    res.status(200).json(data);
  };

  saveDraft = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as SaveAgentOnboardingBody;
    const data = await this.service.saveDraft(req.user!.id, body);
    res.status(200).json(data);
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as SubmitAgentOnboardingBody;
    const data = await this.service.submit(req.user!.id, body);
    res.status(201).json(data);
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AgentSearchQuery;
    const data = await this.assignments.search(query);
    res.status(200).json({ items: data, count: data.length });
  };

  listOpenJobs = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as OpenJobsQuery;
    const minPayCents =
      query.minPay != null ? Math.round(Number(query.minPay) * 100) : undefined;
    const data = await this.openJobs.listOpenJobs(req.user!.id, {
      lng: query.lng,
      lat: query.lat,
      radiusKm: query.radiusKm,
      minPayCents,
      minBuyerRating: query.minBuyerRating,
      minSellerRating: query.minSellerRating,
      maxDistanceKm: query.maxDistanceKm,
      limit: query.limit,
    });
    res.status(200).json({ items: data, count: data.length });
  };

  acceptOpenJob = async (req: Request, res: Response): Promise<void> => {
    const data = await this.openJobs.acceptOpenJob(
      req.user!.id,
      String(req.params.code),
    );
    res.status(200).json(data);
  };

  offerAssignment = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as OfferAssignmentBody;
    const data = await this.assignments.offerAssignment(req.user!.id, body);
    res.status(201).json(data);
  };

  listOffers = async (req: Request, res: Response): Promise<void> => {
    const data = await this.assignments.listMyOffers(req.user!.id);
    res.status(200).json({ items: data });
  };

  acceptOffer = async (req: Request, res: Response): Promise<void> => {
    const data = await this.assignments.acceptOffer(req.user!.id, String(req.params.id));
    res.status(200).json(data);
  };

  rejectOffer = async (req: Request, res: Response): Promise<void> => {
    const data = await this.assignments.rejectOffer(req.user!.id, String(req.params.id));
    res.status(200).json(data);
  };

  reassign = async (req: Request, res: Response): Promise<void> => {
    const data = await this.assignments.reassign(req.user!.id, String(req.params.code));
    res.status(200).json(data);
  };
}
