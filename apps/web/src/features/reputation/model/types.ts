export type PartyRole = 'BUYER' | 'SELLER' | 'AGENT';

export interface RatingSnapshot {
  average: number;
  count: number;
  weightedAverage?: number;
  weightTotal?: number;
  distribution?: {
    one: number;
    two: number;
    three: number;
    four: number;
    five: number;
  };
}

export interface ReputationBreakdown {
  score: number;
  components: {
    rating: number;
    volume: number;
    success: number;
    kyc: number;
    fraudPenalty: number;
  };
  inputs: {
    weightedAverage: number;
    reviewCount: number;
    completed: number;
    cancelled: number;
    disputed: number;
    successRate: number;
    kycVerified: boolean;
  };
}

export interface ReputationDto {
  userId: string;
  displayName: string;
  score: number;
  breakdown: ReputationBreakdown;
  rating: RatingSnapshot;
  roleRatings: {
    buyer: RatingSnapshot;
    seller: RatingSnapshot;
    agent: RatingSnapshot;
  };
  operations: {
    completed: number;
    cancelled: number;
    disputed: number;
    asCreator: number;
    asCounterparty: number;
    asAgent: number;
    totalVolumeCents: number;
    successRate: number;
    reviewsGiven: number;
    reviewsReceived: number;
  };
  reputation: {
    score: number;
    completedTransactions: number;
    cancelledTransactions: number;
    disputedTransactions: number;
  };
}

export interface ReviewItem {
  id: string;
  transactionId: string;
  transactionCode?: string;
  reviewerId: string;
  revieweeId: string;
  reviewerRole: PartyRole;
  revieweeRole: PartyRole;
  rating: number;
  comment?: string;
  weight: number;
  fraudFlags: string[];
  visibility: string;
  createdAt: string;
}

export interface ReviewsPage {
  items: ReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PendingTargets {
  transactionCode: string;
  transactionId: string;
  myRole: PartyRole;
  completedAt?: string;
  windowDays: number;
  targets: Array<{
    userId: string;
    role: PartyRole;
    alreadyReviewed: boolean;
  }>;
}

export interface CreateReviewPayload {
  transactionCode: string;
  revieweeId: string;
  rating: number;
  comment?: string;
}
