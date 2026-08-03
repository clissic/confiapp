import {
  ParticipantRole,
  TransactionStatus,
  type IUser,
} from '@confiapp/database';

import { TransactionModel, UserModel } from '../../database/models';

import {
  computeAgentScore,
  getZonedDateParts,
  hasBlockingException,
  isActiveAgentUser,
  isWithinWeeklySlots,
} from './search-scoring';

export interface AgentSearchParams {
  lng: number;
  lat: number;
  radiusKm: number;
  at?: Date;
  limit?: number;
  excludeUserIds?: string[];
}

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

const ACTIVE_JOB_STATUSES: TransactionStatus[] = [
  TransactionStatus.WAITING_PARTICIPANT,
  TransactionStatus.ACCEPTED,
  TransactionStatus.FUNDED,
  TransactionStatus.IN_PROGRESS,
  TransactionStatus.DISPUTED,
];

export class AgentSearchRepository {
  async countActiveJobs(agentId: string): Promise<number> {
    return TransactionModel.countDocuments({
      deletedAt: null,
      status: { $in: ACTIVE_JOB_STATUSES },
      participants: {
        $elemMatch: {
          user: agentId,
          role: ParticipantRole.INTERMEDIARY,
        },
      },
    }).exec();
  }

  /** Batch count de trabajos activos por agente (evita N+1). */
  async countActiveJobsForAgents(agentIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>(agentIds.map((id) => [id, 0]));
    if (!agentIds.length) return counts;

    const rows = await TransactionModel.aggregate<{ _id: unknown; count: number }>([
      {
        $match: {
          deletedAt: null,
          status: { $in: ACTIVE_JOB_STATUSES },
          'participants.user': { $in: agentIds.map((id) => id) },
          participants: {
            $elemMatch: { role: ParticipantRole.INTERMEDIARY },
          },
        },
      },
      { $unwind: '$participants' },
      {
        $match: {
          'participants.role': ParticipantRole.INTERMEDIARY,
          'participants.user': { $in: agentIds.map((id) => id) },
        },
      },
      { $group: { _id: '$participants.user', count: { $sum: 1 } } },
    ]).exec();

    for (const row of rows) {
      counts.set(String(row._id), row.count);
    }
    return counts;
  }

  async search(params: AgentSearchParams): Promise<AgentSearchHit[]> {
    const radiusMeters = params.radiusKm * 1000;
    const at = params.at ?? new Date();
    const limit = Math.min(params.limit ?? 20, 50);
    const exclude = new Set(params.excludeUserIds ?? []);

    const nearby = (await UserModel.find({
      deletedAt: null,
      status: 'ACTIVE',
      $or: [{ roles: 'AGENT' }, { role: 'AGENT' }],
      'agent.status': 'ACTIVE',
      'location.point': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [params.lng, params.lat],
          },
          $maxDistance: radiusMeters,
        },
      },
    })
      .select(
        'fullName displayName rating roles role status agent location schedule',
      )
      .limit(80)
      .lean()
      .exec()) as Array<IUser & { _id: unknown }>;

    const candidateIds: string[] = [];
    for (const user of nearby) {
      const id = String(user._id);
      if (exclude.has(id)) continue;
      if (!isActiveAgentUser(user)) continue;
      candidateIds.push(id);
    }

    const activeJobsByAgent = await this.countActiveJobsForAgents(candidateIds);
    const hits: AgentSearchHit[] = [];

    for (const user of nearby) {
      const id = String(user._id);
      if (!candidateIds.includes(id)) continue;

      const coords = user.location?.point?.coordinates;
      if (!coords || coords.length < 2) continue;

      const distanceKm = haversineKm(
        params.lat,
        params.lng,
        coords[1]!,
        coords[0]!,
      );

      const coverageRadiusKm =
        user.agent?.coverageRadiusKm ??
        user.location?.coverageRadiusKm ??
        params.radiusKm;

      if (distanceKm > coverageRadiusKm) continue;

      const schedule = user.schedule;
      if (schedule && schedule.isAcceptingAssignments === false) continue;

      const timezone = schedule?.timezone ?? 'America/Montevideo';
      const zoned = getZonedDateParts(at, timezone);

      if (hasBlockingException(schedule?.exceptions, zoned.ymd, timezone)) {
        continue;
      }

      if (
        schedule?.weeklySlots?.length &&
        !isWithinWeeklySlots(schedule.weeklySlots, zoned.dayOfWeek, zoned.minutes)
      ) {
        continue;
      }

      const maxActive = schedule?.maxActiveTransactions ?? 5;
      const activeJobs = activeJobsByAgent.get(id) ?? 0;
      if (activeJobs >= maxActive) continue;

      const score = computeAgentScore({
        distanceKm,
        radiusKm: params.radiusKm,
        ratingAverage: user.rating?.average,
        ratingCount: user.rating?.count,
        activeJobs,
        maxActive,
        coverageRadiusKm,
      });

      hits.push({
        id,
        fullName: user.fullName,
        displayName: user.displayName,
        distanceKm: Number(distanceKm.toFixed(3)),
        ratingAverage: user.rating?.average ?? 0,
        ratingCount: user.rating?.count ?? 0,
        activeJobs,
        maxActiveTransactions: maxActive,
        coverageRadiusKm,
        isAcceptingAssignments: schedule?.isAcceptingAssignments ?? true,
        hourlyRateCents: user.agent?.hourlyRateCents,
        currency: user.agent?.currency,
        timezone,
        score: Number(score.toFixed(4)),
        locationLabel: user.agent?.workAreaLabel ?? user.location?.label,
      });
    }

    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return b.ratingAverage - a.ratingAverage;
    });

    return hits.slice(0, limit);
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
