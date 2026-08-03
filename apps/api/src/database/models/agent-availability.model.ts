import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IAgentAvailability } from '@confiapp/database';

import { applyAgentAvailabilityIndexes } from '../indexes/agent-availability.indexes';
import { agentAvailabilitySchema } from '../schemas/agent-availability.schema';

export type AgentAvailabilityDocument = HydratedDocument<IAgentAvailability>;

applyAgentAvailabilityIndexes(agentAvailabilitySchema);

export const AgentAvailabilityModel: Model<IAgentAvailability> =
  (models.AgentAvailability as Model<IAgentAvailability> | undefined) ??
  model<IAgentAvailability>('AgentAvailability', agentAvailabilitySchema);
