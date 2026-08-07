import { z } from 'zod';

export const auditListQuerySchema = z.object({
  actorId: z.string().optional(),
  entityType: z.string().trim().max(64).optional(),
  entityId: z.string().optional(),
  action: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  before: z.string().optional(),
  /** Si true, solo eventos del usuario autenticado. Default false = listado global (luego solo ADMIN). */
  mine: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
