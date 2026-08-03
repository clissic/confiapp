import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IEvidence } from '@confiapp/database';

import { applyEvidenceIndexes } from '../indexes/evidence.indexes';
import { evidenceSchema } from '../schemas/evidence.schema';

export type EvidenceDocument = HydratedDocument<IEvidence>;

applyEvidenceIndexes(evidenceSchema);

export const EvidenceModel: Model<IEvidence> =
  (models.Evidence as Model<IEvidence> | undefined) ??
  model<IEvidence>('Evidence', evidenceSchema);
