import { z } from 'zod';

import {
  PaymentType,
  WalletMovementDirection,
  WalletMovementType,
} from '@confiapp/database';

export const walletMovementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  type: z.nativeEnum(WalletMovementType).optional(),
  direction: z.nativeEnum(WalletMovementDirection).optional(),
  transactionCode: z.string().trim().max(32).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const walletCommissionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  type: z
    .enum([PaymentType.PLATFORM_FEE, PaymentType.AGENT_PAYOUT])
    .optional(),
  transactionCode: z.string().trim().max(32).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
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
export type WalletCommissionsQuery = z.infer<typeof walletCommissionsQuerySchema>;
export type WalletWithdrawBody = z.infer<typeof walletWithdrawBodySchema>;
