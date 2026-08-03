import { describe, expect, it } from 'vitest';
import {
  IdentityVerificationStatus,
  ReviewFraudFlag,
  ReviewVisibility,
  TransactionPartyRole,
} from '@confiapp/database';

import {
  ALLOWED_REVIEW_PAIRS,
  applyRatingIncrement,
  bayesianRating,
  computeReputationScore,
  computeReviewWeight,
  distributionKey,
  emptyRating,
  isAllowedReviewPair,
} from './scoring';

describe('reviews/scoring', () => {
  it('permite pares buyer/seller/agent válidos', () => {
    expect(isAllowedReviewPair(TransactionPartyRole.BUYER, TransactionPartyRole.SELLER)).toBe(
      true,
    );
    expect(isAllowedReviewPair(TransactionPartyRole.AGENT, TransactionPartyRole.AGENT)).toBe(
      false,
    );
    expect(ALLOWED_REVIEW_PAIRS.length).toBeGreaterThanOrEqual(6);
  });

  it('aplica incremento de rating simple y ponderado', () => {
    const first = applyRatingIncrement(emptyRating(), 5, 1);
    expect(first.count).toBe(1);
    expect(first.average).toBe(5);
    expect(first.distribution.five).toBe(1);

    const second = applyRatingIncrement(first, 3, 0.5);
    expect(second.count).toBe(2);
    expect(second.sum).toBe(8);
    expect(second.weightedSum).toBe(5 + 1.5);
    expect(second.weightTotal).toBe(1.5);
    expect(second.distribution.three).toBe(1);
  });

  it('mapea distributionKey', () => {
    expect(distributionKey(1)).toBe('one');
    expect(distributionKey(2)).toBe('two');
    expect(distributionKey(3)).toBe('three');
    expect(distributionKey(4)).toBe('four');
    expect(distributionKey(5)).toBe('five');
    expect(distributionKey(0)).toBe('one');
  });

  it('calcula bayesianRating hacia el prior', () => {
    expect(bayesianRating(5, 0)).toBeCloseTo(4, 5);
    expect(bayesianRating(5, 5)).toBeCloseTo(4.5, 5);
  });

  it('computa score de reputación con componentes', () => {
    const breakdown = computeReputationScore({
      rating: {
        average: 4.8,
        count: 20,
        sum: 96,
        weightedAverage: 4.7,
        weightedSum: 94,
        weightTotal: 20,
        distribution: { one: 0, two: 0, three: 1, four: 4, five: 15 },
      },
      stats: {
        completedTransactions: 25,
        cancelledTransactions: 1,
        disputedTransactions: 0,
        asCreatorCount: 10,
        asCounterpartyCount: 10,
        asAgentCount: 5,
        totalVolumeCents: 1_000_000,
        averageResponseMinutes: 10,
        reviewsGiven: 10,
        reviewsReceived: 20,
        messagesSent: 100,
        successRate: 96,
      },
      kycStatus: IdentityVerificationStatus.VERIFIED,
      suspiciousReviewCount: 0,
    });

    expect(breakdown.score).toBeGreaterThanOrEqual(70);
    expect(breakdown.score).toBeLessThanOrEqual(100);
    expect(breakdown.components.kyc).toBe(5);
    expect(breakdown.components.fraudPenalty).toBe(0);
    expect(breakdown.inputs.kycVerified).toBe(true);
  });

  it('penaliza disputas y reviews sospechosas', () => {
    const low = computeReputationScore({
      rating: emptyRating(),
      stats: {
        completedTransactions: 2,
        cancelledTransactions: 2,
        disputedTransactions: 3,
        asCreatorCount: 0,
        asCounterpartyCount: 0,
        asAgentCount: 0,
        totalVolumeCents: 0,
        averageResponseMinutes: 0,
        reviewsGiven: 0,
        reviewsReceived: 0,
        messagesSent: 0,
        successRate: 0,
      },
      suspiciousReviewCount: 4,
    });
    expect(low.components.fraudPenalty).toBeGreaterThan(0);
    expect(low.score).toBeLessThan(50);
  });

  it('pondera reviews según fraude y contexto', () => {
    const clean = computeReviewWeight({
      flags: [ReviewFraudFlag.NONE],
      reviewerCompletedOps: 10,
      amountCents: 100_000,
    });
    expect(clean.weight).toBeGreaterThan(1);
    expect(clean.visibility).toBe(ReviewVisibility.PUBLIC);

    const risky = computeReviewWeight({
      flags: [ReviewFraudFlag.RECIPROCAL_SUSPICIOUS, ReviewFraudFlag.RAPID_FIRE],
      reviewerCompletedOps: 0,
      amountCents: 100,
    });
    expect(risky.weight).toBeLessThan(0.5);
    expect(risky.flags).toContain(ReviewFraudFlag.NEW_ACCOUNT);
    expect(risky.flags).toContain(ReviewFraudFlag.LOW_AMOUNT);
    expect(risky.visibility).toBe(ReviewVisibility.PENDING_MODERATION);

    const held = computeReviewWeight({
      flags: [ReviewFraudFlag.MANUAL_HOLD],
      reviewerCompletedOps: 5,
      amountCents: 10_000,
    });
    expect(held.weight).toBe(0);
  });

  it('cubre ratings 1–4 en incremento', () => {
    let r = emptyRating();
    r = applyRatingIncrement(r, 1, 1);
    r = applyRatingIncrement(r, 2, 1);
    r = applyRatingIncrement(r, 4, 1);
    expect(r.distribution.one).toBe(1);
    expect(r.distribution.two).toBe(1);
    expect(r.distribution.four).toBe(1);
  });

  it('score con rating vacío y sin stats', () => {
    const breakdown = computeReputationScore({});
    expect(breakdown.score).toBeGreaterThanOrEqual(0);
    expect(breakdown.inputs.completed).toBe(0);
  });

  it('score usa average si no hay weightTotal', () => {
    const breakdown = computeReputationScore({
      rating: {
        average: 3,
        count: 2,
        sum: 6,
        distribution: { one: 0, two: 0, three: 2, four: 0, five: 0 },
      },
      reputation: {
        score: 10,
        completedTransactions: 3,
        cancelledTransactions: 0,
        disputedTransactions: 0,
      },
      kycStatus: 'VERIFIED',
    });
    expect(breakdown.inputs.kycVerified).toBe(true);
    expect(breakdown.score).toBeGreaterThan(0);
  });
});
