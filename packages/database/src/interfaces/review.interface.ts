import type { Types } from 'mongoose';

import type {
  ReviewFraudFlag,
  ReviewVisibility,
  TransactionPartyRole,
} from '../types/enums';

/**
 * Reseña post-operación entre participantes (comprador / vendedor / agente).
 * Un reviewer solo puede reseñar una vez al mismo reviewee por transaction.
 *
 * La ponderación (`weight`) y las flags de fraude se calculan al crear;
 * los agregados de User usan rating simple + promedio ponderado.
 */
export interface IReview {
  transaction: Types.ObjectId;
  reviewer: Types.ObjectId;
  reviewee: Types.ObjectId;
  reviewerRole: TransactionPartyRole;
  revieweeRole: TransactionPartyRole;
  /** 1–5 */
  rating: number;
  comment?: string;
  /**
   * Peso 0–1.2 usado en promedios ponderados y score de reputación.
   * Default 1; se reduce ante señales de fraude / cuenta nueva / monto bajo.
   */
  weight: number;
  fraudFlags: ReviewFraudFlag[];
  visibility: ReviewVisibility;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
