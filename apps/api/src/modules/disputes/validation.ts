import { z } from 'zod';

export const disputeIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type DisputeIdParamsDto = z.infer<typeof disputeIdParamsSchema>;
