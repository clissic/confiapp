import {
  NotificationChannel,
  NotificationType,
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  TransactionStatus,
  type ITransaction,
} from '@confiapp/database';
import {
  amountCentsToUsd,
  minProductUsdForMinCommission,
} from '@confiapp/shared';
import { Types } from 'mongoose';

import { TransactionModel, UserModel } from '../../database/models';
import { env } from '../../shared/config/env';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/app-error';
import { realtimeServer } from '../../infrastructure/realtime/socket-realtime.server';
import { AuditAction, AuditOutcome, auditService } from '../audit';
import { notificationsService } from '../notifications/service';

import { ACTIVE_AGENT_JOB_STATUSES } from './agent-jobs';
import { AgentAssignmentService } from './assignment.service';

export interface OpenJobsQuery {
  lng: number;
  lat: number;
  radiusKm: number;
  minCommissionUsd?: number;
  minBuyerRating?: number;
  maxBuyerRating?: number;
  minSellerRating?: number;
  maxSellerRating?: number;
  limit?: number;
}

export interface OpenJobDto {
  id: string;
  code: string;
  title: string;
  description?: string;
  status: TransactionStatus;
  amountCents: number;
  currency: string;
  distanceKm: number;
  meeting: {
    lng: number;
    lat: number;
    label?: string;
  };
  buyer: {
    id: string;
    name: string;
    ratingAverage: number;
    ratingCount: number;
  };
  seller: {
    id: string;
    name: string;
    ratingAverage: number;
    ratingCount: number;
  };
  initiatedBy: TransactionInitiator;
  createdAt: string;
}

export interface WithdrawJobResult {
  code: string;
  status: TransactionStatus;
  lookingForAgent: true;
  reopenedViaOffer: boolean;
}

/** Statuses elegibles en open-jobs (sin intermediario ACCEPTED). */
const OPEN_JOB_STATUSES: TransactionStatus[] = [
  TransactionStatus.WAITING_PARTICIPANT,
  TransactionStatus.ACCEPTED,
  TransactionStatus.FUNDED,
  TransactionStatus.IN_PROGRESS,
  TransactionStatus.DISPUTED,
];

const AGENT_WITHDRAW_HISTORY_NOTE = 'Agente solicitó salida / reasignación';

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

function partyRoles(initiatedBy: TransactionInitiator): {
  buyerRole: 'creator' | 'counterparty';
  sellerRole: 'creator' | 'counterparty';
} {
  if (initiatedBy === TransactionInitiator.SELLER) {
    return { buyerRole: 'counterparty', sellerRole: 'creator' };
  }
  return { buyerRole: 'creator', sellerRole: 'counterparty' };
}

function hasAcceptedIntermediary(tx: ITransaction): boolean {
  return tx.participants.some(
    (p) =>
      p.role === ParticipantRole.INTERMEDIARY &&
      p.status === ParticipantStatus.ACCEPTED,
  );
}

export class OpenJobsService {
  constructor(private readonly assignments = new AgentAssignmentService()) {}

  async listOpenJobs(agentId: string, query: OpenJobsQuery): Promise<OpenJobDto[]> {
    const agent = await UserModel.findById(agentId).select('roles role').lean().exec();
    if (!agent) throw new NotFoundError('Usuario no encontrado');

    const radiusMeters = query.radiusKm * 1000;
    const limit = Math.min(query.limit ?? 40, 80);

    // Prefer geo index when meetingLocation exists.
    const geoMatches = (await TransactionModel.find({
      deletedAt: null,
      status: { $in: OPEN_JOB_STATUSES },
      meetingLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.lng, query.lat],
          },
          $maxDistance: radiusMeters,
        },
      },
    })
      .select(
        'code title description status amountCents currency initiatedBy createdBy participants meetingLocation createdAt',
      )
      .limit(limit * 2)
      .lean()
      .exec()) as Array<ITransaction & { _id: unknown }>;

    // Fallback: recent open jobs without meetingLocation (use creator geo).
    const withoutMeeting = (await TransactionModel.find({
      deletedAt: null,
      status: { $in: OPEN_JOB_STATUSES },
      $or: [{ meetingLocation: { $exists: false } }, { meetingLocation: null }],
    })
      .select(
        'code title description status amountCents currency initiatedBy createdBy participants meetingLocation createdAt',
      )
      .sort({ createdAt: -1 })
      .limit(40)
      .lean()
      .exec()) as Array<ITransaction & { _id: unknown }>;

    const byId = new Map<string, ITransaction & { _id: unknown }>();
    for (const tx of [...geoMatches, ...withoutMeeting]) {
      byId.set(String(tx._id), tx);
    }

    const candidateTxs = [...byId.values()].filter((tx) => {
      const agentOid = String(agentId);
      // No listar operaciones donde el agente ya es comprador/vendedor (creador o contraparte).
      if (String(tx.createdBy) === agentOid) return false;
      const asParty = tx.participants.some(
        (p) =>
          String(p.user) === agentOid &&
          p.role !== ParticipantRole.INTERMEDIARY &&
          p.status !== ParticipantStatus.REMOVED,
      );
      if (asParty) return false;
      // Ya es intermediario activo o tiene oferta INVITED pendiente.
      const blockingSelf = tx.participants.some(
        (p) =>
          String(p.user) === agentOid &&
          p.role === ParticipantRole.INTERMEDIARY &&
          (p.status === ParticipantStatus.ACCEPTED ||
            p.status === ParticipantStatus.INVITED),
      );
      if (blockingSelf) return false;

      const hasAgent = tx.participants.some(
        (p) =>
          p.role === ParticipantRole.INTERMEDIARY &&
          (p.status === ParticipantStatus.ACCEPTED ||
            p.status === ParticipantStatus.INVITED),
      );
      return !hasAgent;
    });

    const allUserIds = [
      ...new Set(
        candidateTxs.flatMap((tx) => {
          const counter = tx.participants.find(
            (p) => p.role === ParticipantRole.COUNTERPARTY,
          );
          return [
            String(tx.createdBy),
            counter?.user ? String(counter.user) : undefined,
          ].filter(Boolean) as string[];
        }),
      ),
    ];

    const users = await UserModel.find({ _id: { $in: allUserIds } })
      .select('fullName displayName rating location.point location.label')
      .lean()
      .exec();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const jobs: OpenJobDto[] = [];

    for (const tx of candidateTxs) {
      const creatorId = String(tx.createdBy);
      const counterparty = tx.participants.find(
        (p) => p.role === ParticipantRole.COUNTERPARTY,
      );
      const counterpartyId = counterparty?.user ? String(counterparty.user) : undefined;

      let lng = tx.meetingLocation?.coordinates?.[0];
      let lat = tx.meetingLocation?.coordinates?.[1];
      let label = tx.meetingLocation?.label;

      if (lng == null || lat == null) {
        const creator = userMap.get(creatorId);
        lng = creator?.location?.point?.coordinates?.[0];
        lat = creator?.location?.point?.coordinates?.[1];
        label = label ?? creator?.location?.label;
      }

      if (lng == null || lat == null) continue;

      const distanceKm = haversineKm(query.lat, query.lng, lat, lng);
      if (distanceKm > query.radiusKm) continue;

      const amountCents = tx.amountCents ?? 0;
      const currency = tx.currency ?? 'UYU';
      if (query.minCommissionUsd != null) {
        const productUsd = amountCentsToUsd(amountCents, currency, env.USD_UYU_RATE);
        const minProductUsd = minProductUsdForMinCommission(query.minCommissionUsd);
        if (productUsd < minProductUsd) continue;
      }

      const roles = partyRoles(tx.initiatedBy ?? TransactionInitiator.BUYER);
      const buyerUser =
        roles.buyerRole === 'creator'
          ? userMap.get(creatorId)
          : counterpartyId
            ? userMap.get(counterpartyId)
            : undefined;
      const sellerUser =
        roles.sellerRole === 'creator'
          ? userMap.get(creatorId)
          : counterpartyId
            ? userMap.get(counterpartyId)
            : undefined;

      if (!buyerUser || !sellerUser) continue;

      const buyerRating = buyerUser.rating?.average ?? 0;
      const sellerRating = sellerUser.rating?.average ?? 0;
      if (query.minBuyerRating != null && buyerRating < query.minBuyerRating) continue;
      if (query.maxBuyerRating != null && buyerRating > query.maxBuyerRating) continue;
      if (query.minSellerRating != null && sellerRating < query.minSellerRating) continue;
      if (query.maxSellerRating != null && sellerRating > query.maxSellerRating) continue;

      jobs.push({
        id: String(tx._id),
        code: tx.code,
        title: tx.title,
        description: tx.description,
        status: tx.status,
        amountCents,
        currency,
        distanceKm: Number(distanceKm.toFixed(3)),
        meeting: { lng, lat, label },
        buyer: {
          id: String(buyerUser._id),
          name: buyerUser.displayName || buyerUser.fullName,
          ratingAverage: buyerRating,
          ratingCount: buyerUser.rating?.count ?? 0,
        },
        seller: {
          id: String(sellerUser._id),
          name: sellerUser.displayName || sellerUser.fullName,
          ratingAverage: sellerRating,
          ratingCount: sellerUser.rating?.count ?? 0,
        },
        initiatedBy: tx.initiatedBy ?? TransactionInitiator.BUYER,
        createdAt: new Date(tx.createdAt).toISOString(),
      });
    }

    jobs.sort((a, b) => a.distanceKm - b.distanceKm || b.amountCents - a.amountCents);
    return jobs.slice(0, limit);
  }

  async acceptOpenJob(agentId: string, code: string): Promise<OpenJobDto> {
    const tx = await TransactionModel.findOne({
      code: code.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Trabajo no encontrado');

    if (!OPEN_JOB_STATUSES.includes(tx.status)) {
      throw new ValidationError('Este trabajo ya no está abierto');
    }

    if (hasAcceptedIntermediary(tx)) {
      throw new ValidationError('Otro agente ya tomó este trabajo');
    }

    if (String(tx.createdBy) === agentId) {
      throw new ForbiddenError('No podés mediár tu propia operación');
    }

    const existingAsParty = tx.participants.find(
      (p) =>
        String(p.user) === agentId &&
        p.role !== ParticipantRole.INTERMEDIARY &&
        p.status !== ParticipantStatus.REMOVED,
    );
    if (existingAsParty) {
      throw new ValidationError('Ya participás en esta operación');
    }

    const now = new Date();
    const previousIntermediary = tx.participants.find(
      (p) =>
        String(p.user) === agentId &&
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.REMOVED,
    );

    if (previousIntermediary) {
      previousIntermediary.status = ParticipantStatus.ACCEPTED;
      previousIntermediary.respondedAt = now;
    } else if (
      tx.participants.some(
        (p) =>
          String(p.user) === agentId &&
          p.role === ParticipantRole.INTERMEDIARY &&
          p.status !== ParticipantStatus.REMOVED,
      )
    ) {
      throw new ValidationError('Ya participás en esta operación');
    } else {
      tx.participants.push({
        user: new Types.ObjectId(agentId),
        role: ParticipantRole.INTERMEDIARY,
        status: ParticipantStatus.ACCEPTED,
        invitedAt: now,
        respondedAt: now,
      });
    }

    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(agentId),
      note: 'Agente aceptó el trabajo desde el tablero de trabajos abiertos',
    });
    await tx.save();

    try {
      const { ChatsService } = await import('../chats/service');
      await new ChatsService().ensureTransactionChats(String(tx._id));
    } catch {
      /* no bloquea la aceptación */
    }

    realtimeServer.publish(`transaction:${String(tx._id)}`, 'agent:accepted', {
      agentId,
      transactionCode: tx.code,
      source: 'open_jobs',
    });

    const partyUserIds = [
      String(tx.createdBy),
      ...tx.participants
        .filter(
          (p) =>
            p.role !== ParticipantRole.INTERMEDIARY &&
            p.status === ParticipantStatus.ACCEPTED &&
            p.user,
        )
        .map((p) => String(p.user)),
    ].filter((id, idx, arr) => id !== agentId && arr.indexOf(id) === idx);

    await Promise.all(
      partyUserIds.map((uid) =>
        notificationsService.notify({
          userId: uid,
          type: NotificationType.TRANSACTION_UPDATE,
          title: 'Ya tenés agente asignado',
          body: `Un agente tomó la operación ${tx.code} desde trabajos abiertos.`,
          data: {
            href: `/operaciones/${tx.code}`,
            code: tx.code,
            status: tx.status,
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );

    auditService.track({
      actor: agentId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.AGENT_ACCEPTED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_accept_open_job',
        source: 'open_jobs',
        status: tx.status,
      },
    });
    auditService.track({
      actor: agentId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.PARTICIPANT_ADDED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_accept_open_job',
        role: ParticipantRole.INTERMEDIARY,
      },
    });

    const users = await UserModel.find({
      _id: {
        $in: [
          tx.createdBy,
          ...tx.participants
            .filter((p) => p.role === ParticipantRole.COUNTERPARTY)
            .map((p) => p.user),
        ],
      },
    })
      .select('fullName displayName rating location')
      .lean()
      .exec();

    const creator = users.find((u) => String(u._id) === String(tx.createdBy));
    const counter = users.find((u) => String(u._id) !== String(tx.createdBy));
    const roles = partyRoles(tx.initiatedBy ?? TransactionInitiator.BUYER);
    const buyer = roles.buyerRole === 'creator' ? creator : counter;
    const seller = roles.sellerRole === 'creator' ? creator : counter;
    const lng =
      tx.meetingLocation?.coordinates?.[0] ??
      creator?.location?.point?.coordinates?.[0] ??
      -58.3816;
    const lat =
      tx.meetingLocation?.coordinates?.[1] ??
      creator?.location?.point?.coordinates?.[1] ??
      -34.6037;

    return {
      id: String(tx._id),
      code: tx.code,
      title: tx.title,
      description: tx.description,
      status: tx.status,
      amountCents: tx.amountCents ?? 0,
      currency: tx.currency ?? 'UYU',
      distanceKm: 0,
      meeting: {
        lng,
        lat,
        label: tx.meetingLocation?.label ?? creator?.location?.label,
      },
      buyer: {
        id: buyer ? String(buyer._id) : '',
        name: buyer?.displayName || buyer?.fullName || 'Comprador',
        ratingAverage: buyer?.rating?.average ?? 0,
        ratingCount: buyer?.rating?.count ?? 0,
      },
      seller: {
        id: seller ? String(seller._id) : '',
        name: seller?.displayName || seller?.fullName || 'Vendedor',
        ratingAverage: seller?.rating?.average ?? 0,
        ratingCount: seller?.rating?.count ?? 0,
      },
      initiatedBy: tx.initiatedBy ?? TransactionInitiator.BUYER,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  /**
   * El agente abandona una operación activa: queda REMOVED, escrow intacto,
   * y se reabre intermediación (oferta automática o open-jobs).
   */
  async withdrawFromJob(
    agentId: string,
    code: string,
    reason?: string,
  ): Promise<WithdrawJobResult> {
    const tx = await TransactionModel.findOne({
      code: code.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    if (!ACTIVE_AGENT_JOB_STATUSES.includes(tx.status)) {
      throw new ValidationError('Esta operación no admite salida del agente');
    }

    const intermediary = tx.participants.find(
      (p) =>
        String(p.user) === agentId &&
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (!intermediary) {
      throw new ForbiddenError('No sos el agente activo de esta operación');
    }

    const now = new Date();
    intermediary.status = ParticipantStatus.REMOVED;
    intermediary.respondedAt = now;

    const note = reason?.trim()
      ? `${AGENT_WITHDRAW_HISTORY_NOTE}: ${reason.trim().slice(0, 200)}`
      : AGENT_WITHDRAW_HISTORY_NOTE;

    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(agentId),
      note,
    });
    await tx.save();

    const partyUserIds = [
      String(tx.createdBy),
      ...tx.participants
        .filter(
          (p) =>
            p.role !== ParticipantRole.INTERMEDIARY &&
            p.status === ParticipantStatus.ACCEPTED &&
            p.user,
        )
        .map((p) => String(p.user)),
    ].filter((id, idx, arr) => id !== agentId && arr.indexOf(id) === idx);

    await Promise.all(
      partyUserIds.map((uid) =>
        notificationsService.notify({
          userId: uid,
          type: NotificationType.TRANSACTION_UPDATE,
          title: 'El agente solicitó salida',
          body: `Estamos buscando un nuevo agente para la operación ${tx.code}. El dinero en resguardo no se mueve.`,
          data: {
            href: `/operaciones/${tx.code}`,
            code: tx.code,
            status: tx.status,
            lookingForAgent: true,
          },
          entityType: 'Transaction',
          entityId: String(tx._id),
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );

    realtimeServer.publish(`transaction:${String(tx._id)}`, 'agent:withdrawn', {
      agentId,
      transactionCode: tx.code,
      status: tx.status,
      lookingForAgent: true,
    });

    auditService.track({
      actor: agentId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.AGENT_REASSIGNED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_withdraw',
        status: tx.status,
        note,
      },
    });
    auditService.track({
      actor: agentId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.PARTICIPANT_UPDATED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_withdraw',
        role: ParticipantRole.INTERMEDIARY,
        to: ParticipantStatus.REMOVED,
      },
    });

    let reopenedViaOffer = false;
    const lng = tx.meetingLocation?.coordinates?.[0];
    const lat = tx.meetingLocation?.coordinates?.[1];
    if (lng != null && lat != null) {
      try {
        await this.assignments.offerAssignment(agentId, {
          transactionCode: tx.code,
          lng,
          lat,
          radiusKm: 15,
          excludeAgentIds: [agentId],
        });
        reopenedViaOffer = true;
      } catch {
        /* queda elegible en open-jobs */
      }
    }

    return {
      code: tx.code,
      status: tx.status,
      lookingForAgent: true,
      reopenedViaOffer,
    };
  }
}
