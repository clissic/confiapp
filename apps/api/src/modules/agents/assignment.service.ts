import {
  NotificationActionStatus,
  NotificationChannel,
  NotificationType,
  ParticipantRole,
  ParticipantStatus,
  TransactionStatus,
  type INotification,
} from '@confiapp/database';
import { Types, type HydratedDocument } from 'mongoose';

import { NotificationModel, TransactionModel } from '../../database/models';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { realtimeServer } from '../../infrastructure/realtime/socket-realtime.server';
import { AuditAction, AuditOutcome, auditService } from '../audit';
import { notificationsService } from '../notifications/service';

import { NotificationDeliveryService } from './notification-delivery.service';
import { AgentSearchRepository, type AgentSearchHit } from './search.repository';

export interface OfferAssignmentInput {
  transactionCode: string;
  lng: number;
  lat: number;
  radiusKm: number;
  at?: string;
  expiresInSeconds?: number;
  excludeAgentIds?: string[];
}

export interface AgentNotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  actionStatus?: string;
  expiresAt?: string;
  respondedAt?: string;
  data?: Record<string, unknown>;
  entityId?: string;
  readAt?: string;
  createdAt: string;
  isExpired: boolean;
}

export class AgentAssignmentService {
  constructor(
    private readonly searchRepo = new AgentSearchRepository(),
    private readonly delivery = new NotificationDeliveryService(),
  ) {}

  async search(params: {
    lng: number;
    lat: number;
    radiusKm: number;
    at?: string;
    limit?: number;
  }): Promise<AgentSearchHit[]> {
    return this.searchRepo.search({
      lng: params.lng,
      lat: params.lat,
      radiusKm: params.radiusKm,
      at: params.at ? new Date(params.at) : new Date(),
      limit: params.limit,
    });
  }

  async offerAssignment(
    requesterId: string,
    input: OfferAssignmentInput,
  ): Promise<{
    notification: AgentNotificationDto;
    agent: AgentSearchHit;
    candidatesRemaining: number;
  }> {
    const tx = await TransactionModel.findOne({
      code: input.transactionCode.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const isParticipant =
      String(tx.createdBy) === requesterId ||
      tx.participants.some((p) => String(p.user) === requesterId);
    if (!isParticipant) {
      throw new ForbiddenError('No tenés acceso a esta operación');
    }

    if (
      tx.status === TransactionStatus.CANCELLED ||
      tx.status === TransactionStatus.COMPLETED
    ) {
      throw new ValidationError('La operación no admite asignación de agente');
    }

    const hasIntermediary = tx.participants.some(
      (p) =>
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (hasIntermediary) {
      throw new ValidationError('La operación ya tiene un agente aceptado');
    }

    await this.expirePendingForTransaction(String(tx._id));

    const pending = await NotificationModel.findOne({
      type: NotificationType.AGENT_ASSIGNMENT,
      entityType: 'Transaction',
      entityId: tx._id,
      actionStatus: NotificationActionStatus.PENDING,
      deletedAt: null,
    }).exec();
    if (pending) {
      throw new ValidationError(
        'Ya hay una oferta pendiente. Esperá la respuesta o reasigná.',
      );
    }

    const exclude = new Set(input.excludeAgentIds ?? []);
    const previouslyOffered = await NotificationModel.find({
      type: NotificationType.AGENT_ASSIGNMENT,
      entityId: tx._id,
      deletedAt: null,
    })
      .select('user')
      .lean()
      .exec();
    for (const n of previouslyOffered) {
      exclude.add(String(n.user));
    }

    const hits = await this.searchRepo.search({
      lng: input.lng,
      lat: input.lat,
      radiusKm: input.radiusKm,
      at: input.at ? new Date(input.at) : new Date(),
      limit: 20,
      excludeUserIds: [...exclude],
    });

    if (!hits.length) {
      throw new ValidationError('No hay agentes disponibles que cumplan los criterios');
    }

    const agent = hits[0]!;
    const expiresIn = input.expiresInSeconds ?? 120;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const queue = hits.slice(1).map((h) => h.id);
    const notification = await this.delivery.createAndDeliverOffer({
      userId: agent.id,
      title: `Nueva asignación · ${tx.code}`,
      body: `Te ofrecieron mediar “${tx.title}”. Tenés ${expiresIn}s para aceptar o rechazar.`,
      entityId: String(tx._id),
      expiresAt,
      data: {
        transactionId: String(tx._id),
        transactionCode: tx.code,
        lng: input.lng,
        lat: input.lat,
        radiusKm: input.radiusKm,
        at: input.at ?? new Date().toISOString(),
        candidateQueue: queue,
        score: agent.score,
        distanceKm: agent.distanceKm,
      },
    });

    realtimeServer.publish(`transaction:${String(tx._id)}`, 'agent:offer:sent', {
      agentId: agent.id,
      notificationId: String(notification._id),
      expiresAt: expiresAt.toISOString(),
    });

    auditService.track({
      actor: requesterId,
      action: AuditAction.AGENT_OFFERED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_offered',
        agentId: agent.id,
        notificationId: String(notification._id),
        expiresAt: expiresAt.toISOString(),
        candidatesRemaining: queue.length,
      },
    });

    return {
      notification: this.toDto(notification),
      agent,
      candidatesRemaining: queue.length,
    };
  }

  async listMyOffers(userId: string): Promise<AgentNotificationDto[]> {
    await this.expireDueOffers();
    const list = await NotificationModel.find({
      user: userId,
      type: NotificationType.AGENT_ASSIGNMENT,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return list.map((n) => this.toDto(n));
  }

  async acceptOffer(userId: string, notificationId: string): Promise<AgentNotificationDto> {
    await this.expireDueOffers();
    const notification = await NotificationModel.findOne({
      _id: notificationId,
      user: userId,
      type: NotificationType.AGENT_ASSIGNMENT,
      deletedAt: null,
    }).exec();
    if (!notification) throw new NotFoundError('Oferta no encontrada');

    if (notification.actionStatus !== NotificationActionStatus.PENDING) {
      throw new ValidationError(`La oferta ya está en estado ${notification.actionStatus}`);
    }
    if (notification.expiresAt && notification.expiresAt.getTime() < Date.now()) {
      notification.actionStatus = NotificationActionStatus.EXPIRED;
      notification.respondedAt = new Date();
      await notification.save();
      await this.delivery.emitUpdate(userId, notification);
      await this.reassignFromExpiredOrRejected(notification);
      throw new ValidationError('La oferta expiró');
    }

    const tx = await TransactionModel.findById(notification.entityId).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const already = tx.participants.some(
      (p) =>
        p.role === ParticipantRole.INTERMEDIARY &&
        p.status === ParticipantStatus.ACCEPTED,
    );
    if (already) {
      throw new ValidationError('Otro agente ya aceptó esta operación');
    }

    const now = new Date();
    tx.participants.push({
      user: new Types.ObjectId(userId),
      role: ParticipantRole.INTERMEDIARY,
      status: ParticipantStatus.ACCEPTED,
      invitedAt: now,
      respondedAt: now,
    });
    tx.statusHistory.push({
      status: tx.status,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: 'Agente intermediario aceptó la asignación',
    });
    await tx.save();

    notification.actionStatus = NotificationActionStatus.ACCEPTED;
    notification.respondedAt = now;
    notification.readAt = now;
    await notification.save();
    await this.delivery.emitUpdate(userId, notification);

    try {
      const { ChatsService } = await import('../chats/service');
      await new ChatsService().ensureTransactionChats(String(tx._id));
    } catch {
      /* no bloquea la aceptación */
    }

    realtimeServer.publish(`transaction:${String(tx._id)}`, 'agent:accepted', {
      agentId: userId,
      notificationId: String(notification._id),
      transactionCode: tx.code,
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
    ].filter((id, idx, arr) => id !== userId && arr.indexOf(id) === idx);

    await Promise.all(
      partyUserIds.map((uid) =>
        notificationsService.notify({
          userId: uid,
          type: NotificationType.TRANSACTION_UPDATE,
          title: 'Ya tenés agente asignado',
          body: `Un agente aceptó mediar la operación ${tx.code}.`,
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
      actor: userId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.AGENT_ACCEPTED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_accept_offer',
        notificationId: String(notification._id),
        source: 'offer',
      },
    });
    auditService.track({
      actor: userId,
      actorRole: ParticipantRole.INTERMEDIARY,
      action: AuditAction.PARTICIPANT_ADDED,
      entityType: 'Transaction',
      entityId: String(tx._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: tx.code,
      metadata: {
        code: tx.code,
        step: 'agent_accept_offer',
        role: ParticipantRole.INTERMEDIARY,
      },
    });

    return this.toDto(notification);
  }

  async rejectOffer(userId: string, notificationId: string): Promise<{
    notification: AgentNotificationDto;
    reassigned?: AgentNotificationDto;
  }> {
    await this.expireDueOffers();
    const notification = await NotificationModel.findOne({
      _id: notificationId,
      user: userId,
      type: NotificationType.AGENT_ASSIGNMENT,
      deletedAt: null,
    }).exec();
    if (!notification) throw new NotFoundError('Oferta no encontrada');

    if (notification.actionStatus !== NotificationActionStatus.PENDING) {
      throw new ValidationError(`La oferta ya está en estado ${notification.actionStatus}`);
    }

    notification.actionStatus = NotificationActionStatus.REJECTED;
    notification.respondedAt = new Date();
    await notification.save();
    await this.delivery.emitUpdate(userId, notification);

    auditService.track({
      actor: userId,
      action: AuditAction.AGENT_REJECTED,
      entityType: 'Notification',
      entityId: String(notification._id),
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        code: notification.entityId ? String(notification.entityId) : undefined,
        step: 'agent_rejected',
        transactionId: notification.entityId ? String(notification.entityId) : undefined,
      },
    });

    const reassigned = await this.reassignFromExpiredOrRejected(notification);
    return {
      notification: this.toDto(notification),
      reassigned: reassigned ? this.toDto(reassigned) : undefined,
    };
  }

  async reassign(
    requesterId: string,
    transactionCode: string,
  ): Promise<{
    notification?: AgentNotificationDto;
    agent?: AgentSearchHit;
    message: string;
  }> {
    const tx = await TransactionModel.findOne({
      code: transactionCode.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const isParticipant =
      String(tx.createdBy) === requesterId ||
      tx.participants.some((p) => String(p.user) === requesterId);
    if (!isParticipant) throw new ForbiddenError('No tenés acceso a esta operación');

    const pending = await NotificationModel.findOne({
      type: NotificationType.AGENT_ASSIGNMENT,
      entityId: tx._id,
      actionStatus: NotificationActionStatus.PENDING,
      deletedAt: null,
    }).exec();

    if (pending) {
      pending.actionStatus = NotificationActionStatus.REASSIGNED;
      pending.respondedAt = new Date();
      await pending.save();
      await this.delivery.emitUpdate(String(pending.user), pending);
      const next = await this.reassignFromExpiredOrRejected(pending);
      if (!next) {
        return { message: 'No quedan candidatos para reasignar' };
      }
      const agentId = String(next.user);
      const hits = await this.searchRepo.search({
        lng: Number(pending.data?.lng ?? 0),
        lat: Number(pending.data?.lat ?? 0),
        radiusKm: Number(pending.data?.radiusKm ?? 10),
        limit: 5,
      });
      const agent = hits.find((h) => h.id === agentId);
      auditService.track({
        actor: requesterId,
        action: AuditAction.AGENT_REASSIGNED,
        entityType: 'Transaction',
        entityId: String(tx._id),
        outcome: AuditOutcome.SUCCESS,
        correlationId: tx.code,
        metadata: {
          fromNotificationId: String(pending._id),
          toNotificationId: String(next._id),
          agentId,
        },
      });
      return {
        notification: this.toDto(next),
        agent,
        message: 'Oferta reasignada al siguiente agente',
      };
    }

    throw new ValidationError('No hay oferta pendiente para reasignar');
  }

  async expireDueOffers(): Promise<number> {
    const due = await NotificationModel.find({
      type: NotificationType.AGENT_ASSIGNMENT,
      actionStatus: NotificationActionStatus.PENDING,
      expiresAt: { $lte: new Date() },
      deletedAt: null,
    }).exec();

    for (const notification of due) {
      notification.actionStatus = NotificationActionStatus.EXPIRED;
      notification.respondedAt = new Date();
      await notification.save();
      await this.delivery.emitUpdate(String(notification.user), notification);
      await this.reassignFromExpiredOrRejected(notification);
    }
    return due.length;
  }

  private async expirePendingForTransaction(transactionId: string): Promise<void> {
    const pending = await NotificationModel.find({
      type: NotificationType.AGENT_ASSIGNMENT,
      entityId: transactionId,
      actionStatus: NotificationActionStatus.PENDING,
      expiresAt: { $lte: new Date() },
      deletedAt: null,
    }).exec();
    for (const n of pending) {
      n.actionStatus = NotificationActionStatus.EXPIRED;
      n.respondedAt = new Date();
      await n.save();
      await this.delivery.emitUpdate(String(n.user), n);
    }
  }

  private async reassignFromExpiredOrRejected(
    previous: HydratedDocument<INotification>,
  ): Promise<HydratedDocument<INotification> | null> {
    const data = (previous.data ?? {}) as {
      candidateQueue?: string[];
      lng?: number;
      lat?: number;
      radiusKm?: number;
      at?: string;
      transactionCode?: string;
    };
    const queue = [...(data.candidateQueue ?? [])];
    if (!queue.length || !previous.entityId) return null;

    const nextAgentId = queue.shift()!;
    const expiresAt = new Date(Date.now() + 120 * 1000);

    const tx = await TransactionModel.findById(previous.entityId).lean().exec();
    const code = tx?.code ?? data.transactionCode ?? '';

    const next = await this.delivery.createAndDeliverOffer({
      userId: nextAgentId,
      title: `Reasignación · ${code}`,
      body: `Se te reasignó la mediación de “${tx?.title ?? code}”. Tenés 120s para responder.`,
      entityId: String(previous.entityId),
      expiresAt,
      reassignedFrom: String(previous._id),
      data: {
        ...data,
        candidateQueue: queue,
        reassignedFromNotificationId: String(previous._id),
        transactionCode: code,
      },
    });

    realtimeServer.publish(`transaction:${String(previous.entityId)}`, 'agent:reassigned', {
      fromNotificationId: String(previous._id),
      toNotificationId: String(next._id),
      agentId: nextAgentId,
    });

    auditService.track({
      actor: nextAgentId,
      action: AuditAction.AGENT_REASSIGNED,
      entityType: 'Transaction',
      entityId: String(previous.entityId),
      outcome: AuditOutcome.SUCCESS,
      correlationId: code || undefined,
      metadata: {
        fromNotificationId: String(previous._id),
        toNotificationId: String(next._id),
        agentId: nextAgentId,
        source: 'auto_queue',
      },
    });

    return next;
  }

  private toDto(
    n: {
      _id: unknown;
      type: string;
      title: string;
      body: string;
      actionStatus?: string;
      expiresAt?: Date;
      respondedAt?: Date;
      data?: Record<string, unknown>;
      entityId?: unknown;
      readAt?: Date;
      createdAt: Date;
    },
  ): AgentNotificationDto {
    const expiresAt = n.expiresAt;
    return {
      id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body,
      actionStatus: n.actionStatus,
      expiresAt: expiresAt?.toISOString(),
      respondedAt: n.respondedAt?.toISOString(),
      data: n.data,
      entityId: n.entityId ? String(n.entityId) : undefined,
      readAt: n.readAt?.toISOString(),
      createdAt: n.createdAt.toISOString(),
      isExpired: Boolean(
        n.actionStatus === NotificationActionStatus.EXPIRED ||
          (expiresAt &&
            expiresAt.getTime() < Date.now() &&
            n.actionStatus === NotificationActionStatus.PENDING),
      ),
    };
  }
}
