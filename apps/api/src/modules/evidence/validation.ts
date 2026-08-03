import { z } from 'zod';

export const evidenceIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type EvidenceIdParamsDto = z.infer<typeof evidenceIdParamsSchema>;
