import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IDispute } from '@confiapp/database';

import { applyDisputeIndexes } from '../indexes/dispute.indexes';
import { disputeSchema } from '../schemas/dispute.schema';

export type DisputeDocument = HydratedDocument<IDispute>;

applyDisputeIndexes(disputeSchema);

export const DisputeModel: Model<IDispute> =
  (models.Dispute as Model<IDispute> | undefined) ?? model<IDispute>('Dispute', disputeSchema);
