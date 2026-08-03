import {
  IdentityVerificationStatus,
  ReviewFraudFlag,
  ReviewVisibility,
  TransactionPartyRole,
  type UserRating,
  type UserReputation,
  type UserStats,
} from '@confiapp/database';

/** Ventana para dejar reseña tras COMPLETED. */
export const REVIEW_WINDOW_DAYS = 30;

/** Pares permitidos (quien califica → a quién). */
export const ALLOWED_REVIEW_PAIRS: ReadonlyArray<
  readonly [TransactionPartyRole, TransactionPartyRole]
> = [
  [TransactionPartyRole.BUYER, TransactionPartyRole.SELLER],
  [TransactionPartyRole.BUYER, TransactionPartyRole.AGENT],
  [TransactionPartyRole.SELLER, TransactionPartyRole.BUYER],
  [TransactionPartyRole.SELLER, TransactionPartyRole.AGENT],
  [TransactionPartyRole.AGENT, TransactionPartyRole.BUYER],
  [TransactionPartyRole.AGENT, TransactionPartyRole.SELLER],
];

export function isAllowedReviewPair(
  reviewerRole: TransactionPartyRole,
  revieweeRole: TransactionPartyRole,
): boolean {
  return ALLOWED_REVIEW_PAIRS.some(
    ([from, to]) => from === reviewerRole && to === revieweeRole,
  );
}

export function emptyRating(): UserRating {
  return {
    average: 0,
    count: 0,
    sum: 0,
    weightedSum: 0,
    weightTotal: 0,
    weightedAverage: 0,
    distribution: { one: 0, two: 0, three: 0, four: 0, five: 0 },
  };
}

export function applyRatingIncrement(
  current: UserRating | undefined,
  rating: number,
  weight: number,
): UserRating {
  const base = current ?? emptyRating();
  const dist = { ...(base.distribution ?? emptyRating().distribution) };
  const key =
    rating === 1
      ? 'one'
      : rating === 2
        ? 'two'
        : rating === 3
          ? 'three'
          : rating === 4
            ? 'four'
            : 'five';
  dist[key] = (dist[key] ?? 0) + 1;

  const sum = (base.sum ?? 0) + rating;
  const count = (base.count ?? 0) + 1;
  const weightedSum = (base.weightedSum ?? 0) + rating * weight;
  const weightTotal = (base.weightTotal ?? 0) + weight;

  return {
    sum,
    count,
    average: count > 0 ? Number((sum / count).toFixed(3)) : 0,
    weightedSum,
    weightTotal,
    weightedAverage:
      weightTotal > 0 ? Number((weightedSum / weightTotal).toFixed(3)) : 0,
    distribution: dist,
  };
}

/** Rating bayesiano suavizado hacia 4.0 con prior de 5. */
export function bayesianRating(average: number, count: number): number {
  const priorAvg = 4;
  const priorN = 5;
  return (average * count + priorAvg * priorN) / (count + priorN);
}

export interface ScoreBreakdown {
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

/**
 * Score 0–100 ponderado:
 * - 55 pts: promedio bayesiano (usa weightedAverage si existe)
 * - 25 pts: volumen de operaciones completadas (log)
 * - 15 pts: tasa de éxito
 * - 5 pts: KYC verificado
 * - penalización por disputas / reviews sospechosas
 */
export function computeReputationScore(input: {
  rating?: UserRating;
  stats?: UserStats;
  reputation?: UserReputation;
  kycStatus?: IdentityVerificationStatus | string;
  suspiciousReviewCount?: number;
}): ScoreBreakdown {
  const count = input.rating?.count ?? 0;
  const weightedAverage =
    (input.rating?.weightTotal ?? 0) > 0
      ? (input.rating?.weightedAverage ?? input.rating?.average ?? 0)
      : (input.rating?.average ?? 0);

  const bayes = bayesianRating(weightedAverage || 0, count);
  const ratingPts = (bayes / 5) * 55;

  const completed =
    input.stats?.completedTransactions ??
    input.reputation?.completedTransactions ??
    0;
  const cancelled =
    input.stats?.cancelledTransactions ??
    input.reputation?.cancelledTransactions ??
    0;
  const disputed =
    input.stats?.disputedTransactions ??
    input.reputation?.disputedTransactions ??
    0;

  const volumePts =
    completed <= 0
      ? 0
      : Math.min(25, (Math.log10(completed + 1) / Math.log10(51)) * 25);

  const totalOps = completed + cancelled + disputed;
  const successRate =
    totalOps > 0
      ? (completed / totalOps) * 100
      : (input.stats?.successRate ?? 0);
  const successPts = (successRate / 100) * 15;

  const kycVerified =
    input.kycStatus === IdentityVerificationStatus.VERIFIED ||
    input.kycStatus === 'VERIFIED';
  const kycPts = kycVerified ? 5 : 0;

  const fraudPenalty = Math.min(
    25,
    disputed * 3 + (input.suspiciousReviewCount ?? 0) * 4,
  );

  const raw = ratingPts + volumePts + successPts + kycPts - fraudPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    components: {
      rating: Number(ratingPts.toFixed(2)),
      volume: Number(volumePts.toFixed(2)),
      success: Number(successPts.toFixed(2)),
      kyc: kycPts,
      fraudPenalty: Number(fraudPenalty.toFixed(2)),
    },
    inputs: {
      weightedAverage: Number(weightedAverage.toFixed(3)),
      reviewCount: count,
      completed,
      cancelled,
      disputed,
      successRate: Number(successRate.toFixed(2)),
      kycVerified,
    },
  };
}

export function computeReviewWeight(input: {
  flags: ReviewFraudFlag[];
  reviewerCompletedOps: number;
  amountCents: number;
}): { weight: number; flags: ReviewFraudFlag[]; visibility: ReviewVisibility } {
  let weight = 1;
  const flags = [...input.flags].filter((f) => f !== ReviewFraudFlag.NONE);

  if (input.reviewerCompletedOps < 2) {
    flags.push(ReviewFraudFlag.NEW_ACCOUNT);
    weight *= 0.65;
  }

  if (input.amountCents > 0 && input.amountCents < 500) {
    flags.push(ReviewFraudFlag.LOW_AMOUNT);
    weight *= 0.75;
  } else if (input.amountCents >= 50_000) {
    weight *= 1.1;
  }

  if (flags.includes(ReviewFraudFlag.RECIPROCAL_SUSPICIOUS)) {
    weight *= 0.35;
  }
  if (flags.includes(ReviewFraudFlag.RAPID_FIRE)) {
    weight *= 0.4;
  }
  if (flags.includes(ReviewFraudFlag.MANUAL_HOLD)) {
    weight = 0;
  }

  weight = Math.max(0, Math.min(1.2, Number(weight.toFixed(3))));

  const visibility =
    flags.includes(ReviewFraudFlag.MANUAL_HOLD) ||
    (flags.includes(ReviewFraudFlag.RECIPROCAL_SUSPICIOUS) &&
      flags.includes(ReviewFraudFlag.RAPID_FIRE))
      ? ReviewVisibility.PENDING_MODERATION
      : ReviewVisibility.PUBLIC;

  return {
    weight,
    flags: flags.length ? flags : [ReviewFraudFlag.NONE],
    visibility,
  };
}

export function distributionKey(
  rating: number,
): 'one' | 'two' | 'three' | 'four' | 'five' {
  if (rating <= 1) return 'one';
  if (rating === 2) return 'two';
  if (rating === 3) return 'three';
  if (rating === 4) return 'four';
  return 'five';
}
