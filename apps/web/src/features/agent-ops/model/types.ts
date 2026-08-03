export interface AgentSearchHit {
  id: string;
  fullName: string;
  displayName?: string;
  distanceKm: number;
  ratingAverage: number;
  ratingCount: number;
  activeJobs: number;
  maxActiveTransactions: number;
  coverageRadiusKm: number;
  isAcceptingAssignments: boolean;
  hourlyRateCents?: number;
  currency?: string;
  timezone: string;
  score: number;
  locationLabel?: string;
}

export type OfferActionStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REASSIGNED'
  | 'SUPERSEDED';

export interface AgentOffer {
  id: string;
  type: string;
  title: string;
  body: string;
  actionStatus?: OfferActionStatus;
  expiresAt?: string;
  respondedAt?: string;
  data?: Record<string, unknown>;
  entityId?: string;
  readAt?: string;
  createdAt: string;
  isExpired: boolean;
}

export const OFFER_STATUS_LABELS: Record<OfferActionStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
  REASSIGNED: 'Reasignada',
  SUPERSEDED: 'Reemplazada',
};
