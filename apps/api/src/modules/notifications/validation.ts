import { z } from 'zod';

export const notificationsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type NotificationsListQuery = z.infer<typeof notificationsListQuerySchema>;
