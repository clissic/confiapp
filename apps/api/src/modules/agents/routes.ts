import { Router } from 'express';

import { asyncHandler, authenticate, validateRequest } from '../../middleware';
import { AgentsController } from './controller';
import {
  agentSearchQuerySchema,
  notificationIdParamsSchema,
  offerAssignmentBodySchema,
  openJobsQuerySchema,
  saveAgentOnboardingBodySchema,
  submitAgentOnboardingBodySchema,
  transactionCodeParamsSchema,
  withdrawJobBodySchema,
} from './validation';

const controller = new AgentsController();

export const agentsRoutes: Router = Router();

agentsRoutes.get('/onboarding', authenticate, asyncHandler(controller.getOnboarding));

agentsRoutes.put(
  '/onboarding',
  authenticate,
  validateRequest({ body: saveAgentOnboardingBodySchema }),
  asyncHandler(controller.saveDraft),
);

agentsRoutes.post(
  '/onboarding/submit',
  authenticate,
  validateRequest({ body: submitAgentOnboardingBodySchema }),
  asyncHandler(controller.submit),
);

agentsRoutes.post('/onboarding/suspend', authenticate, asyncHandler(controller.suspend));

agentsRoutes.post('/onboarding/resume', authenticate, asyncHandler(controller.resume));

agentsRoutes.post('/onboarding/close', authenticate, asyncHandler(controller.closeAgency));

agentsRoutes.get(
  '/search',
  authenticate,
  validateRequest({ query: agentSearchQuerySchema }),
  asyncHandler(controller.search),
);

agentsRoutes.get(
  '/jobs/open',
  authenticate,
  validateRequest({ query: openJobsQuerySchema }),
  asyncHandler(controller.listOpenJobs),
);

agentsRoutes.post(
  '/jobs/:code/accept',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.acceptOpenJob),
);

agentsRoutes.post(
  '/jobs/:code/withdraw',
  authenticate,
  validateRequest({
    params: transactionCodeParamsSchema,
    body: withdrawJobBodySchema,
  }),
  asyncHandler(controller.withdrawFromJob),
);

agentsRoutes.post(
  '/assignments/offer',
  authenticate,
  validateRequest({ body: offerAssignmentBodySchema }),
  asyncHandler(controller.offerAssignment),
);

agentsRoutes.post(
  '/assignments/:code/reassign',
  authenticate,
  validateRequest({ params: transactionCodeParamsSchema }),
  asyncHandler(controller.reassign),
);

agentsRoutes.get('/offers', authenticate, asyncHandler(controller.listOffers));

agentsRoutes.post(
  '/offers/:id/accept',
  authenticate,
  validateRequest({ params: notificationIdParamsSchema }),
  asyncHandler(controller.acceptOffer),
);

agentsRoutes.post(
  '/offers/:id/reject',
  authenticate,
  validateRequest({ params: notificationIdParamsSchema }),
  asyncHandler(controller.rejectOffer),
);
