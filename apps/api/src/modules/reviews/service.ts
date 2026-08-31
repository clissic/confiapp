import {
  ParticipantRole,
  ParticipantStatus,
  ReviewFraudFlag,
  ReviewVisibility,
  TransactionInitiator,
  TransactionPartyRole,
  TransactionStatus,
  type IReview,
  type ITransaction,
  type IUser,
} from '@confiapp/database';
import { Types, type HydratedDocument } from 'mongoose';

import { ReviewModel, TransactionModel, UserModel } from '../../database/models';
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/app-error';
import { AuditAction, AuditOutcome, auditService } from '../audit';

import {
  ALLOWED_REVIEW_PAIRS,
  REVIEW_WINDOW_DAYS,
  applyRatingIncrement,
  computeReputationScore,
  computeReviewWeight,
  emptyRating,
  isAllowedReviewPair,
} from './scoring';

type TxDoc = HydratedDocument<ITransaction>;

export function resolveParties(tx: {
  createdBy: unknown;
  initiatedBy?: TransactionInitiator;
  participants: Array<{
    user: unknown;
    role: ParticipantRole;
    status: ParticipantStatus;
  }>;
}): {
  buyerId: string;
  sellerId: string;
  agentId?: string;
} {
  const initiatedBy = tx.initiatedBy ?? TransactionInitiator.BUYER;
  const buyerIsCreator = initiatedBy === TransactionInitiator.BUYER;
  const counter = tx.participants.find((p) => p.role === ParticipantRole.COUNTERPARTY);
  const agent = tx.participants.find(
    (p) =>
      p.role === ParticipantRole.INTERMEDIARY &&
      p.status === ParticipantStatus.ACCEPTED,
  );
  const creatorId = String(tx.createdBy);
  const counterId = counter ? String(counter.user) : undefined;
  const buyerId = buyerIsCreator ? creatorId : counterId;
  const sellerId = buyerIsCreator ? counterId : creatorId;
  if (!buyerId || !sellerId) {
    throw new ValidationError('La operación aún no tiene comprador y vendedor definidos');
  }
  return {
    buyerId,
    sellerId,
    agentId: agent ? String(agent.user) : undefined,
  };
}

function roleOfUser(
  parties: { buyerId: string; sellerId: string; agentId?: string },
  userId: string,
): TransactionPartyRole | null {
  if (parties.buyerId === userId) return TransactionPartyRole.BUYER;
  if (parties.sellerId === userId) return TransactionPartyRole.SELLER;
  if (parties.agentId === userId) return TransactionPartyRole.AGENT;
  return null;
}

function toReviewDto(
  row: IReview & { _id: Types.ObjectId },
  extras?: { transactionCode?: string },
) {
  return {
    id: String(row._id),
    transactionId: String(row.transaction),
    transactionCode: extras?.transactionCode,
    reviewerId: String(row.reviewer),
    revieweeId: String(row.reviewee),
    reviewerRole: row.reviewerRole,
    revieweeRole: row.revieweeRole,
    rating: row.rating,
    comment: row.comment,
    weight: row.weight,
    fraudFlags: row.fraudFlags,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  };
}

function ratingDto(rating?: IUser['rating']) {
  const r = rating ?? emptyRating();
  return {
    average: r.average ?? 0,
    count: r.count ?? 0,
    sum: r.sum ?? 0,
    weightedAverage: r.weightedAverage ?? r.average ?? 0,
    weightTotal: r.weightTotal ?? 0,
    distribution: r.distribution ?? emptyRating().distribution,
  };
}

export class ReputationService {
  /** Hook post-COMPLETED: actualiza conteos por rol y score. */
  async onTransactionCompleted(tx: TxDoc): Promise<void> {
    let parties: ReturnType<typeof resolveParties>;
    try {
      parties = resolveParties(tx);
    } catch {
      return;
    }

    const volume = tx.amountCents ?? 0;
    const updates: Array<{ userId: string; role: TransactionPartyRole }> = [
      { userId: parties.buyerId, role: TransactionPartyRole.BUYER },
      { userId: parties.sellerId, role: TransactionPartyRole.SELLER },
    ];
    if (parties.agentId) {
      updates.push({ userId: parties.agentId, role: TransactionPartyRole.AGENT });
    }

    for (const item of updates) {
      const user = await UserModel.findById(item.userId).exec();
      if (!user) continue;

      user.stats = user.stats ?? ({} as IUser['stats']);
      user.reputation = user.reputation ?? {
        score: 0,
        completedTransactions: 0,
        cancelledTransactions: 0,
        disputedTransactions: 0,
      };

      user.stats.completedTransactions = (user.stats.completedTransactions ?? 0) + 1;
      user.reputation.completedTransactions =
        (user.reputation.completedTransactions ?? 0) + 1;
      user.stats.totalVolumeCents = (user.stats.totalVolumeCents ?? 0) + volume;
      user.stats.lastActiveAt = new Date();

      if (item.role === TransactionPartyRole.AGENT) {
        user.stats.asAgentCount = (user.stats.asAgentCount ?? 0) + 1;
      } else if (String(tx.createdBy) === item.userId) {
        user.stats.asCreatorCount = (user.stats.asCreatorCount ?? 0) + 1;
      } else {
        user.stats.asCounterpartyCount = (user.stats.asCounterpartyCount ?? 0) + 1;
      }

      const completed = user.stats.completedTransactions;
      const cancelled = user.stats.cancelledTransactions ?? 0;
      const disputed = user.stats.disputedTransactions ?? 0;
      const denom = completed + cancelled + disputed;
      user.stats.successRate =
        denom > 0 ? Number(((completed / denom) * 100).toFixed(2)) : 100;

      const breakdown = computeReputationScore({
        rating: user.rating,
        stats: user.stats,
        reputation: user.reputation,
        kycStatus: user.kyc?.status ?? user.verification?.identity?.status,
      });
      user.reputation.score = breakdown.score;

      await user.save();
    }
  }

  async getReputation(userId: string) {
    const user = await UserModel.findById(userId)
      .select('fullName displayName rating roleRatings stats reputation kyc verification')
      .lean()
      .exec();
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const suspicious = await ReviewModel.countDocuments({
      reviewee: userId,
      deletedAt: null,
      fraudFlags: {
        $in: [
          ReviewFraudFlag.RECIPROCAL_SUSPICIOUS,
          ReviewFraudFlag.RAPID_FIRE,
          ReviewFraudFlag.MANUAL_HOLD,
        ],
      },
    }).exec();

    const breakdown = computeReputationScore({
      rating: user.rating,
      stats: user.stats,
      reputation: user.reputation,
      kycStatus: user.kyc?.status ?? user.verification?.identity?.status,
      suspiciousReviewCount: suspicious,
    });

    const roleRatings = user.roleRatings ?? {
      buyer: emptyRating(),
      seller: emptyRating(),
      agent: emptyRating(),
    };

    return {
      userId: String(user._id),
      displayName: user.displayName || user.fullName,
      score: breakdown.score,
      breakdown,
      rating: ratingDto(user.rating),
      roleRatings: {
        buyer: ratingDto(roleRatings.buyer),
        seller: ratingDto(roleRatings.seller),
        agent: ratingDto(roleRatings.agent),
      },
      operations: {
        completed: user.stats?.completedTransactions ?? 0,
        cancelled: user.stats?.cancelledTransactions ?? 0,
        disputed: user.stats?.disputedTransactions ?? 0,
        asCreator: user.stats?.asCreatorCount ?? 0,
        asCounterparty: user.stats?.asCounterpartyCount ?? 0,
        asAgent: user.stats?.asAgentCount ?? 0,
        totalVolumeCents: user.stats?.totalVolumeCents ?? 0,
        successRate: user.stats?.successRate ?? 0,
        reviewsGiven: user.stats?.reviewsGiven ?? 0,
        reviewsReceived: user.stats?.reviewsReceived ?? 0,
      },
      reputation: {
        score: breakdown.score,
        completedTransactions: user.reputation?.completedTransactions ?? 0,
        cancelledTransactions: user.reputation?.cancelledTransactions ?? 0,
        disputedTransactions: user.reputation?.disputedTransactions ?? 0,
      },
    };
  }

  async listPendingTargets(userId: string, transactionCode: string) {
    const tx = await TransactionModel.findOne({
      code: transactionCode.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (tx.status !== TransactionStatus.COMPLETED) {
      throw new ValidationError('Solo se puede calificar operaciones completadas');
    }

    const parties = resolveParties(tx);
    const myRole = roleOfUser(parties, userId);
    if (!myRole) throw new ForbiddenError('No participás en esta operación');

    const existing = await ReviewModel.find({
      transaction: tx._id,
      reviewer: userId,
      deletedAt: null,
    })
      .select('reviewee')
      .lean()
      .exec();
    const reviewed = new Set(existing.map((r) => String(r.reviewee)));

    const candidates: Array<{
      userId: string;
      role: TransactionPartyRole;
      alreadyReviewed: boolean;
    }> = [];

    for (const [from, to] of ALLOWED_REVIEW_PAIRS) {
      if (from !== myRole) continue;
      const targetId =
        to === TransactionPartyRole.BUYER
          ? parties.buyerId
          : to === TransactionPartyRole.SELLER
            ? parties.sellerId
            : parties.agentId;
      if (!targetId || targetId === userId) continue;
      candidates.push({
        userId: targetId,
        role: to,
        alreadyReviewed: reviewed.has(targetId),
      });
    }

    return {
      transactionCode: tx.code,
      transactionId: String(tx._id),
      myRole,
      completedAt: tx.completedAt?.toISOString(),
      windowDays: REVIEW_WINDOW_DAYS,
      targets: candidates,
    };
  }

  async createReview(
    reviewerId: string,
    input: {
      transactionCode: string;
      revieweeId: string;
      rating: number;
      comment?: string;
    },
  ) {
    const tx = await TransactionModel.findOne({
      code: input.transactionCode.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');
    if (tx.status !== TransactionStatus.COMPLETED) {
      throw new ValidationError('Solo se puede calificar operaciones completadas');
    }
    if (!tx.completedAt) {
      throw new ValidationError('La operación no tiene fecha de cierre');
    }
    const windowMs = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - tx.completedAt.getTime() > windowMs) {
      throw new ValidationError(
        `El plazo para calificar expiró (${REVIEW_WINDOW_DAYS} días)`,
      );
    }

    if (reviewerId === input.revieweeId) {
      throw new ValidationError('No podés calificarte a vos mismo');
    }

    const parties = resolveParties(tx);
    const reviewerRole = roleOfUser(parties, reviewerId);
    const revieweeRole = roleOfUser(parties, input.revieweeId);
    if (!reviewerRole || !revieweeRole) {
      throw new ForbiddenError('Ambos deben ser participantes de la operación');
    }
    if (!isAllowedReviewPair(reviewerRole, revieweeRole)) {
      throw new ValidationError(
        `No se permite calificar ${reviewerRole} → ${revieweeRole}`,
      );
    }

    const duplicate = await ReviewModel.findOne({
      transaction: tx._id,
      reviewer: reviewerId,
      reviewee: input.revieweeId,
      deletedAt: null,
    })
      .lean()
      .exec();
    if (duplicate) {
      throw new AppError(409, 'Ya calificaste a este participante en esta operación', undefined, 'CONFLICT');
    }

    const flags = await this.detectFraudFlags({
      reviewerId,
      revieweeId: input.revieweeId,
      transactionId: String(tx._id),
      rating: input.rating,
    });

    const reviewer = await UserModel.findById(reviewerId)
      .select('stats')
      .lean()
      .exec();
    const weightInfo = computeReviewWeight({
      flags,
      reviewerCompletedOps: reviewer?.stats?.completedTransactions ?? 0,
      amountCents: tx.amountCents ?? 0,
    });

    let created;
    try {
      created = await ReviewModel.create({
        transaction: tx._id,
        reviewer: new Types.ObjectId(reviewerId),
        reviewee: new Types.ObjectId(input.revieweeId),
        reviewerRole,
        revieweeRole,
        rating: input.rating,
        comment: input.comment?.trim() || undefined,
        weight: weightInfo.weight,
        fraudFlags: weightInfo.flags,
        visibility: weightInfo.visibility,
      });
    } catch (error: unknown) {
      const code = (error as { code?: number })?.code;
      if (code === 11000) {
        throw new AppError(409, 'Ya calificaste a este participante en esta operación', undefined, 'CONFLICT');
      }
      throw error;
    }

    if (weightInfo.visibility === ReviewVisibility.PUBLIC && weightInfo.weight > 0) {
      await this.applyReviewAggregates({
        reviewerId,
        revieweeId: input.revieweeId,
        revieweeRole,
        rating: input.rating,
        weight: weightInfo.weight,
      });
    } else {
      await UserModel.updateOne(
        { _id: reviewerId },
        { $inc: { 'stats.reviewsGiven': 1 } },
      ).exec();
    }

    auditService.track({
      actor: reviewerId,
      action: AuditAction.REVIEW_CREATED,
      entityType: 'Review',
      entityId: String(created._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        revieweeId: input.revieweeId,
        reviewerRole,
        revieweeRole,
        rating: input.rating,
        weight: weightInfo.weight,
        fraudFlags: weightInfo.flags,
        visibility: weightInfo.visibility,
      },
    });

    return toReviewDto(created.toObject());
  }

  private async detectFraudFlags(input: {
    reviewerId: string;
    revieweeId: string;
    transactionId: string;
    rating: number;
  }): Promise<ReviewFraudFlag[]> {
    const flags: ReviewFraudFlag[] = [];
    const now = Date.now();

    const reciprocal = await ReviewModel.findOne({
      transaction: input.transactionId,
      reviewer: input.revieweeId,
      reviewee: input.reviewerId,
      deletedAt: null,
    })
      .lean()
      .exec();

    if (
      reciprocal &&
      reciprocal.rating === input.rating &&
      now - new Date(reciprocal.createdAt).getTime() < 2 * 60 * 60 * 1000
    ) {
      flags.push(ReviewFraudFlag.RECIPROCAL_SUSPICIOUS);
    }

    const recentCount = await ReviewModel.countDocuments({
      reviewer: input.reviewerId,
      deletedAt: null,
      createdAt: { $gte: new Date(now - 10 * 60 * 1000) },
    }).exec();
    if (recentCount >= 3) {
      flags.push(ReviewFraudFlag.RAPID_FIRE);
    }

    return flags;
  }

  private async applyReviewAggregates(input: {
    reviewerId: string;
    revieweeId: string;
    revieweeRole: TransactionPartyRole;
    rating: number;
    weight: number;
  }): Promise<void> {
    const reviewee = await UserModel.findById(input.revieweeId).exec();
    if (!reviewee) return;

    reviewee.rating = applyRatingIncrement(reviewee.rating, input.rating, input.weight);
    reviewee.roleRatings = reviewee.roleRatings ?? {
      buyer: emptyRating(),
      seller: emptyRating(),
      agent: emptyRating(),
    };

    const roleKey =
      input.revieweeRole === TransactionPartyRole.BUYER
        ? 'buyer'
        : input.revieweeRole === TransactionPartyRole.SELLER
          ? 'seller'
          : 'agent';
    reviewee.roleRatings[roleKey] = applyRatingIncrement(
      reviewee.roleRatings[roleKey],
      input.rating,
      input.weight,
    );

    reviewee.stats = reviewee.stats ?? ({} as IUser['stats']);
    reviewee.stats.reviewsReceived = (reviewee.stats.reviewsReceived ?? 0) + 1;

    const suspicious = await ReviewModel.countDocuments({
      reviewee: input.revieweeId,
      deletedAt: null,
      fraudFlags: {
        $in: [
          ReviewFraudFlag.RECIPROCAL_SUSPICIOUS,
          ReviewFraudFlag.RAPID_FIRE,
          ReviewFraudFlag.MANUAL_HOLD,
        ],
      },
    }).exec();

    const breakdown = computeReputationScore({
      rating: reviewee.rating,
      stats: reviewee.stats,
      reputation: reviewee.reputation,
      kycStatus: reviewee.kyc?.status ?? reviewee.verification?.identity?.status,
      suspiciousReviewCount: suspicious,
    });
    reviewee.reputation = reviewee.reputation ?? {
      score: 0,
      completedTransactions: 0,
      cancelledTransactions: 0,
      disputedTransactions: 0,
    };
    reviewee.reputation.score = breakdown.score;
    await reviewee.save();

    await UserModel.updateOne(
      { _id: input.reviewerId },
      { $inc: { 'stats.reviewsGiven': 1 } },
    ).exec();
  }

  async listReviews(opts: {
    userId?: string;
    as?: 'received' | 'given';
    role?: 'BUYER' | 'SELLER' | 'AGENT';
    transactionCode?: string;
    limit?: number;
    page?: number;
    flaggedOnly?: boolean;
    includeNonPublic?: boolean;
  }) {
    const limit = Math.min(opts.limit ?? 40, 100);
    const page = Math.max(1, opts.page ?? 1);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {
      deletedAt: null,
      visibility: ReviewVisibility.PUBLIC,
    };

    if (opts.includeNonPublic || opts.transactionCode) {
      delete filter.visibility;
    }

    if (opts.transactionCode) {
      const tx = await TransactionModel.findOne({
        code: opts.transactionCode.toUpperCase(),
        deletedAt: null,
      })
        .select('_id')
        .lean()
        .exec();
      if (!tx) throw new NotFoundError('Operación no encontrada');
      filter.transaction = tx._id;
    }

    if (opts.userId) {
      if (opts.as === 'given') filter.reviewer = opts.userId;
      else filter.reviewee = opts.userId;
    }

    if (opts.role) {
      if (opts.as === 'given') filter.reviewerRole = opts.role;
      else filter.revieweeRole = opts.role;
    }

    if (opts.flaggedOnly) {
      const activeFlags = Object.values(ReviewFraudFlag).filter(
        (f) => f !== ReviewFraudFlag.NONE,
      );
      filter.$or = [
        { weight: { $lt: 1 } },
        { fraudFlags: { $in: activeFlags } },
      ];
    }

    const [total, rows] = await Promise.all([
      ReviewModel.countDocuments(filter).exec(),
      ReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const txIds = [
      ...new Set(rows.map((row) => String(row.transaction)).filter(Boolean)),
    ];
    const txCodeById = new Map<string, string>();
    if (txIds.length) {
      const txs = await TransactionModel.find({
        _id: { $in: txIds.map((id) => new Types.ObjectId(id)) },
        deletedAt: null,
      })
        .select('_id code')
        .lean()
        .exec();
      for (const tx of txs) {
        txCodeById.set(String(tx._id), tx.code);
      }
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: rows.map((row) =>
        toReviewDto(row as IReview & { _id: Types.ObjectId }, {
          transactionCode: txCodeById.get(String(row.transaction)),
        }),
      ),
      total,
      page,
      limit,
      totalPages,
    };
  }
}

export const reputationService = new ReputationService();
