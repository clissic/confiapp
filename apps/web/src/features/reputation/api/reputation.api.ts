import { apiClient } from '@/shared/api/client';

import type {
  CreateReviewPayload,
  PendingTargets,
  ReputationDto,
  ReviewItem,
} from '../model/types';

function hasToken(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

const DEMO_REPUTATION: ReputationDto = {
  userId: 'demo-user',
  displayName: 'Usuario demo',
  score: 78,
  breakdown: {
    score: 78,
    components: {
      rating: 44.2,
      volume: 14.1,
      success: 13.5,
      kyc: 5,
      fraudPenalty: 0,
    },
    inputs: {
      weightedAverage: 4.6,
      reviewCount: 12,
      completed: 18,
      cancelled: 1,
      disputed: 0,
      successRate: 94.7,
      kycVerified: true,
    },
  },
  rating: {
    average: 4.6,
    count: 12,
    weightedAverage: 4.55,
    distribution: { one: 0, two: 0, three: 1, four: 4, five: 7 },
  },
  roleRatings: {
    buyer: { average: 4.7, count: 5, weightedAverage: 4.65 },
    seller: { average: 4.5, count: 5, weightedAverage: 4.48 },
    agent: { average: 4.8, count: 2, weightedAverage: 4.8 },
  },
  operations: {
    completed: 18,
    cancelled: 1,
    disputed: 0,
    asCreator: 9,
    asCounterparty: 7,
    asAgent: 2,
    totalVolumeCents: 24500000,
    successRate: 94.7,
    reviewsGiven: 10,
    reviewsReceived: 12,
  },
  reputation: {
    score: 78,
    completedTransactions: 18,
    cancelledTransactions: 1,
    disputedTransactions: 0,
  },
};

const DEMO_REVIEWS: ReviewItem[] = [
  {
    id: 'r1',
    transactionId: 't1',
    reviewerId: 'u2',
    revieweeId: 'demo-user',
    reviewerRole: 'BUYER',
    revieweeRole: 'SELLER',
    rating: 5,
    comment: 'Entrega impecable y comunicación clara.',
    weight: 1,
    fraudFlags: ['NONE'],
    visibility: 'PUBLIC',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'r2',
    transactionId: 't2',
    reviewerId: 'u3',
    revieweeId: 'demo-user',
    reviewerRole: 'SELLER',
    revieweeRole: 'AGENT',
    rating: 4,
    comment: 'Mediación ágil.',
    weight: 0.9,
    fraudFlags: ['NONE'],
    visibility: 'PUBLIC',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export async function fetchMyReputation(): Promise<ReputationDto> {
  if (!hasToken()) return DEMO_REPUTATION;
  const { data } = await apiClient.get<ReputationDto>('/reviews/reputation/me');
  return data;
}

export async function fetchMyReviews(): Promise<ReviewItem[]> {
  if (!hasToken()) return DEMO_REVIEWS;
  const { data } = await apiClient.get<{ items: ReviewItem[] }>('/reviews', {
    params: { mine: 'true', as: 'received', limit: 40 },
  });
  return data.items;
}

export async function fetchPendingTargets(code: string): Promise<PendingTargets> {
  const { data } = await apiClient.get<PendingTargets>('/reviews/pending', {
    params: { code },
  });
  return data;
}

export async function createReview(payload: CreateReviewPayload): Promise<ReviewItem> {
  const { data } = await apiClient.post<ReviewItem>('/reviews', payload);
  return data;
}
