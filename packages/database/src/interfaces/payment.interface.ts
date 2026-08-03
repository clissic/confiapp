import type { Types } from 'mongoose';

import type {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from '../types/enums';

/**
 * Movimiento / intent de pago asociado a una Transaction.
 * Monto siempre en centavos enteros.
 */
export interface IPayment {
  transaction: Types.ObjectId;
  payer: Types.ObjectId;
  payee?: Types.ObjectId;
  type: PaymentType;
  status: PaymentStatus;
  provider: PaymentProvider;
  amountCents: number;
  currency: string;
  /** Id externo del PSP (Stripe/MP). */
  externalId?: string;
  idempotencyKey: string;
  failureReason?: string;
  authorizedAt?: Date;
  capturedAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
