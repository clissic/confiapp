import {
  DisputeCategory,
  DisputeModel,
  DisputeStatus,
  NotificationChannel,
  NotificationType,
  PaymentModel,
  PaymentStatus,
  PaymentType,
  PlatformRole,
  TransactionModel,
  TransactionStatus,
  UserModel,
  type ITransaction,
} from '@confiapp/database';
import { Types } from 'mongoose';

import { paymentProvider } from '../../infrastructure/payments/mercadopago.payment-provider';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { agentCommissionService } from '../finance/commission.service';
import { financialAudit } from '../finance/financial-audit.service';
import { notificationsService } from '../notifications/service';
import { resolveTransactionPartyIds } from '../transactions/delivery-deadline';
import { assertTransition } from '../transactions/state-machine';

import type {
  ActiveDisputeDto,
  DisputeDetailDto,
  DisputeListItemDto,
  DisputeListResponseDto,
  DisputeOpenResultDto,
  DisputeResolveResultDto,
  DisputesStatusDto,
} from './dto';
import { DisputesRepository, mapActiveDisputeDto } from './repository';

const ACTIVE_STATUSES = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

function userDisplayName(user?: {
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): string | undefined {
  if (!user) return undefined;
  const profileName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.displayName?.trim() || profileName || user.email;
}

export class DisputesService {
  constructor(private readonly repository = new DisputesRepository()) {}

  async getStatus(): Promise<DisputesStatusDto> {
    return { module: 'disputes', status: 'ready' };
  }

  async loadActiveDisputeForTransaction(
    transactionId: string,
  ): Promise<ActiveDisputeDto | undefined> {
    const dispute = await this.repository.findActiveByTransaction(transactionId);
    if (!dispute) return undefined;
    return mapActiveDisputeDto(dispute);
  }

  async openDispute(input: {
    userId: string;
    transactionCode: string;
    reason: string;
    category?: DisputeCategory;
  }): Promise<DisputeOpenResultDto> {
    const tx = await TransactionModel.findOne({
      code: input.transactionCode.toUpperCase(),
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const parties = resolveTransactionPartyIds(
      tx as Parameters<typeof resolveTransactionPartyIds>[0],
    );
    if (parties.buyerId !== input.userId) {
      throw new ForbiddenError('Solo el comprador puede abrir una disputa en esta operación');
    }

    if (
      tx.status !== TransactionStatus.FUNDED &&
      tx.status !== TransactionStatus.IN_PROGRESS
    ) {
      throw new ValidationError(
        'Solo podés reportar un problema mientras la operación está activa (pago protegido o en curso).',
        { status: tx.status },
      );
    }

    const existing = await this.repository.findActiveByTransaction(String(tx._id));
    if (existing) {
      throw new ValidationError('Ya hay una disputa abierta para esta operación.');
    }

    const now = new Date();
    const reason = input.reason.trim().slice(0, 500);
    const category = input.category ?? DisputeCategory.OTHER;

    assertTransition(tx.status, TransactionStatus.DISPUTED);
    tx.status = TransactionStatus.DISPUTED;
    tx.disputedAt = now;
    tx.statusHistory.push({
      status: TransactionStatus.DISPUTED,
      changedAt: now,
      changedBy: new Types.ObjectId(input.userId),
      note: 'Disputa abierta por el comprador',
    });
    await tx.save();

    const dispute = await DisputeModel.create({
      transaction: tx._id,
      openedBy: new Types.ObjectId(input.userId),
      status: DisputeStatus.OPEN,
      category,
      reason,
      openedAt: now,
    });

    await agentCommissionService.setDisputeBlocked(String(tx._id), true);

    await financialAudit.record({
      action: 'DISPUTE_OPENED',
      idempotencyKey: `fa:dispute-open:${String(dispute._id)}`,
      operationId: String(tx._id),
      actorId: input.userId,
      metadata: { reason, category },
      newStatus: DisputeStatus.OPEN,
    });

    await this.notifyDisputeOpened({
      tx,
      disputeId: String(dispute._id),
      buyerId: input.userId,
      sellerId: parties.sellerId,
      agentId: parties.agentId,
      category,
    });

    return {
      id: String(dispute._id),
      transactionCode: tx.code,
      status: dispute.status,
    };
  }

  async listAdmin(input: {
    page: number;
    limit: number;
    status?: DisputeStatus;
  }): Promise<DisputeListResponseDto> {
    const { items, total } = await this.repository.listAdmin(input);
    const totalPages = Math.max(1, Math.ceil(total / input.limit));

    const mapped: DisputeListItemDto[] = items.map((row) => ({
      id: String(row._id),
      transactionCode: row.transaction?.code ?? '—',
      transactionStatus: row.transaction?.status ?? TransactionStatus.DISPUTED,
      status: row.status,
      category: row.category,
      reason: row.reason,
      openedByName: userDisplayName(row.openedBy),
      openedByEmail: row.openedBy?.email,
      openedAt: (row.openedAt ?? row.createdAt).toISOString(),
    }));

    return {
      items: mapped,
      total,
      page: input.page,
      totalPages,
    };
  }

  async getDetail(disputeId: string): Promise<DisputeDetailDto> {
    const row = await this.repository.findDetailById(disputeId);
    if (!row) throw new NotFoundError('Disputa no encontrada');

    return {
      id: String(row._id),
      status: row.status,
      category: row.category,
      reason: row.reason,
      resolutionNote: row.resolutionNote,
      openedAt: (row.openedAt ?? row.createdAt).toISOString(),
      resolvedAt: row.resolvedAt?.toISOString(),
      transaction: {
        id: String(row.transaction?._id ?? row.transaction),
        code: row.transaction?.code ?? '—',
        status: row.transaction?.status ?? TransactionStatus.DISPUTED,
        title: row.transaction?.title ?? 'Operación',
      },
      openedBy: {
        id: String(row.openedBy?._id ?? row.openedBy),
        displayName: userDisplayName(row.openedBy),
        email: row.openedBy?.email,
      },
      ...(row.resolvedBy
        ? {
            resolvedBy: {
              id: String(row.resolvedBy?._id ?? row.resolvedBy),
              displayName: userDisplayName(row.resolvedBy),
            },
          }
        : {}),
    };
  }

  async resolveDispute(input: {
    adminId: string;
    disputeId: string;
    outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND';
    notes?: string;
  }): Promise<DisputeResolveResultDto> {
    const dispute = await DisputeModel.findById(input.disputeId).exec();
    if (!dispute) throw new NotFoundError('Disputa no encontrada');
    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.CLOSED
    ) {
      throw new ValidationError('La disputa ya está cerrada');
    }

    const tx = await TransactionModel.findById(dispute.transaction).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    const now = new Date();
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolutionNote = input.notes?.trim().slice(0, 1000);
    dispute.resolvedAt = now;
    dispute.resolvedBy = new Types.ObjectId(input.adminId);
    await dispute.save();

    let historyNote = 'Disputa resuelta por administración';
    if (input.outcome === 'RESUME') {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      tx.status = TransactionStatus.IN_PROGRESS;
      historyNote = 'Disputa resuelta: operación reanudada';
      tx.statusHistory.push({
        status: TransactionStatus.IN_PROGRESS,
        changedAt: now,
        changedBy: new Types.ObjectId(input.adminId),
        note: historyNote,
      });
      await tx.save();
      await agentCommissionService.setDisputeBlocked(String(tx._id), false);
    } else if (input.outcome === 'CANCEL') {
      assertTransition(tx.status, TransactionStatus.CANCELLED);
      tx.status = TransactionStatus.CANCELLED;
      tx.cancelledAt = now;
      historyNote = 'Disputa resuelta: operación cancelada';
      tx.statusHistory.push({
        status: TransactionStatus.CANCELLED,
        changedAt: now,
        changedBy: new Types.ObjectId(input.adminId),
        note: historyNote,
      });
      await tx.save();
      await agentCommissionService.reverseForTransaction(
        String(tx._id),
        'DISPUTE_CANCEL',
      );
    } else {
      const hold = await PaymentModel.findOne({
        transaction: tx._id,
        type: PaymentType.ESCROW_HOLD,
        deletedAt: null,
      }).exec();
      if (hold?.externalId) {
        await paymentProvider.refundPayment(hold.externalId);
        hold.status = PaymentStatus.REFUNDED;
        hold.refundedAt = now;
        await hold.save();
      }
      await agentCommissionService.reverseForTransaction(
        String(tx._id),
        'REFUND_TOTAL',
      );
      assertTransition(tx.status, TransactionStatus.CANCELLED);
      tx.status = TransactionStatus.CANCELLED;
      tx.cancelledAt = now;
      historyNote = 'Disputa resuelta: reembolso al comprador';
      tx.statusHistory.push({
        status: TransactionStatus.CANCELLED,
        changedAt: now,
        changedBy: new Types.ObjectId(input.adminId),
        note: historyNote,
      });
      await tx.save();
    }

    await financialAudit.record({
      action: 'DISPUTE_RESOLVED',
      idempotencyKey: `fa:dispute-resolve:${String(dispute._id)}`,
      operationId: String(tx._id),
      actorId: input.adminId,
      actorRole: 'ADMIN',
      previousStatus: DisputeStatus.OPEN,
      newStatus: DisputeStatus.RESOLVED,
      metadata: { outcome: input.outcome },
    });

    const parties = resolveTransactionPartyIds(
      tx as Parameters<typeof resolveTransactionPartyIds>[0],
    );
    await this.notifyDisputeResolved({
      tx,
      outcome: input.outcome,
      buyerId: parties.buyerId,
      sellerId: parties.sellerId,
      agentId: parties.agentId,
    });

    return {
      id: String(dispute._id),
      status: dispute.status,
      transactionStatus: tx.status,
    };
  }

  private async notifyDisputeOpened(input: {
    tx: { _id: unknown; code: string; status: TransactionStatus };
    disputeId: string;
    buyerId: string;
    sellerId?: string;
    agentId?: string;
    category: DisputeCategory;
  }) {
    const href = `/operaciones/${input.tx.code}`;
    const categoryLabel =
      input.category === DisputeCategory.NON_DELIVERY
        ? 'No recibió el producto'
        : 'Reporte del comprador';

    const partyIds = [input.sellerId, input.agentId].filter(
      (id): id is string => Boolean(id),
    );

    await Promise.all([
      ...partyIds.map((userId) =>
        notificationsService.notify({
          userId,
          type: NotificationType.DISPUTE,
          title: `Disputa abierta · ${input.tx.code}`,
          body: `El comprador reportó un problema (${categoryLabel}). La liberación de fondos quedó pausada.`,
          data: {
            href,
            code: input.tx.code,
            status: input.tx.status,
            step: 'dispute_opened',
            disputeId: input.disputeId,
          },
          entityType: 'Dispute',
          entityId: input.disputeId,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
      notificationsService.notify({
        userId: input.buyerId,
        type: NotificationType.DISPUTE,
        title: 'Reporte registrado',
        body: `Recibimos tu reporte sobre ${input.tx.code}. Un administrador lo revisará pronto.`,
        data: {
          href,
          code: input.tx.code,
          status: input.tx.status,
          step: 'dispute_opened_buyer',
          disputeId: input.disputeId,
        },
        entityType: 'Dispute',
        entityId: input.disputeId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      }),
      this.notifyAdminsDisputeOpened(input.tx.code, input.disputeId, categoryLabel),
    ]);
  }

  private async notifyAdminsDisputeOpened(
    code: string,
    disputeId: string,
    categoryLabel: string,
  ) {
    const admins = await UserModel.find({
      deletedAt: null,
      $or: [{ role: PlatformRole.ADMIN }, { roles: PlatformRole.ADMIN }],
    })
      .select('_id')
      .lean()
      .exec();

    await Promise.all(
      admins.map((admin) =>
        notificationsService.notify({
          userId: String(admin._id),
          type: NotificationType.DISPUTE,
          title: `Nueva disputa · ${code}`,
          body: `${categoryLabel}. Revisá el caso en administración.`,
          data: {
            href: '/admin/disputas',
            code,
            step: 'dispute_opened',
            disputeId,
          },
          entityType: 'Dispute',
          entityId: disputeId,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );
  }

  private async notifyDisputeResolved(input: {
    tx: { code: string; status: TransactionStatus };
    outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND';
    buyerId?: string;
    sellerId?: string;
    agentId?: string;
  }) {
    const href = `/operaciones/${input.tx.code}`;
    const bodies: Record<typeof input.outcome, string> = {
      RESUME: `La disputa de ${input.tx.code} se resolvió. La operación sigue en curso.`,
      CANCEL: `La disputa de ${input.tx.code} se resolvió. La operación fue cancelada.`,
      COMPLETE_WITH_REFUND: `La disputa de ${input.tx.code} se resolvió. Se inició el reembolso al comprador.`,
    };
    const body = bodies[input.outcome];
    const recipientIds = [input.buyerId, input.sellerId, input.agentId].filter(
      (id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx,
    );

    await Promise.all(
      recipientIds.map((userId) =>
        notificationsService.notify({
          userId,
          type: NotificationType.DISPUTE,
          title: `Disputa resuelta · ${input.tx.code}`,
          body,
          data: {
            href,
            code: input.tx.code,
            status: input.tx.status,
            step: 'dispute_resolved',
            outcome: input.outcome,
          },
          entityType: 'Transaction',
          entityId: input.tx.code,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
    );
  }
}
