import { z } from 'zod';

export const createReviewBodySchema = z.object({
  transactionCode: z.string().trim().min(4).max(32),
  revieweeId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export const reviewsListQuerySchema = z.object({
  userId: z.string().optional(),
  as: z.enum(['received', 'given']).optional(),
  /** Rol del calificado (received) o del calificador (given). */
  role: z.enum(['BUYER', 'SELLER', 'AGENT']).optional(),
  transactionCode: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /** Solo reseñas con peso < 1 o señales activas (panel admin). */
  flaggedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const pendingTargetsQuerySchema = z.object({
  code: z.string().trim().min(4).max(32),
});

export const reputationParamsSchema = z.object({
  userId: z.string().min(1),
});

export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;
export type ReviewsListQuery = z.infer<typeof reviewsListQuerySchema>;
