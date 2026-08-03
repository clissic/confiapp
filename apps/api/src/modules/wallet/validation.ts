import { z } from 'zod';

export const walletMovementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  type: z.string().trim().max(64).optional(),
});

export const walletWithdrawBodySchema = z.object({
  /** Monto en unidad mayor (ej. 500 = $500 UYU). Se convierte a centavos. */
  amount: z.coerce.number().positive().max(100_000_000),
  destinationHint: z.string().trim().max(120).optional(),
});

export const walletWithdrawalIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type WalletMovementsQuery = z.infer<typeof walletMovementsQuerySchema>;
export type WalletWithdrawBody = z.infer<typeof walletWithdrawBodySchema>;
