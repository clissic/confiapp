import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import {
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  TransactionStatus,
  type ITransaction,
  type TransactionMeetingLocation,
  type TransactionPartyInstructions,
  type TransactionPartySides,
} from '@confiapp/database';

import { TransactionModel } from '../../database/models';
import { assertTransition } from './state-machine';

export type TransactionDocument = HydratedDocument<ITransaction>;

const INVITE_SELECT = '+inviteTokenHash';

function sanitizeMeetingLocation(
  loc?: TransactionMeetingLocation | null,
): TransactionMeetingLocation | undefined {
  if (
    !loc ||
    loc.type !== 'Point' ||
    !Array.isArray(loc.coordinates) ||
    loc.coordinates.length !== 2 ||
    !loc.coordinates.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    return undefined;
  }
  return {
    type: 'Point',
    coordinates: loc.coordinates,
    label: loc.label?.trim() || undefined,
  };
}

export class TransactionsRepository {
  async create(data: {
    code: string;
    title: string;
    description?: string;
    createdBy: string;
    initiatedBy: TransactionInitiator;
    productId?: string;
    meetingLocation?: TransactionMeetingLocation;
    party?: TransactionPartySides;
    returnInstructions?: string;
    conditions: {
      summary: string;
      checklist?: Array<{ id: string; text: string; done: boolean }>;
    };
    amountCents: number;
    currency: string;
    feePayer: string;
    inviteTokenHash: string;
    inviteExpiresAt: Date;
  }): Promise<TransactionDocument> {
    const now = new Date();
    const initiatorLabel =
      data.initiatedBy === TransactionInitiator.SELLER ? 'vendedor' : 'comprador';
    const waitingNote =
      data.initiatedBy === TransactionInitiator.SELLER
        ? 'Enlace generado para el comprador — esperando aceptación'
        : 'Enlace de invitación generado — esperando contraparte';

    const meetingLocation = sanitizeMeetingLocation(data.meetingLocation);

    return TransactionModel.create({
      code: data.code,
      title: data.title,
      description: data.description,
      createdBy: data.createdBy,
      initiatedBy: data.initiatedBy,
      product: data.productId,
      ...(meetingLocation ? { meetingLocation } : {}),
      ...(data.party ? { party: data.party } : {}),
      ...(data.returnInstructions?.trim()
        ? { returnInstructions: data.returnInstructions.trim() }
        : {}),
      conditions: data.conditions,
      amountCents: data.amountCents,
      currency: data.currency,
      feePayer: data.feePayer,
      inviteTokenHash: data.inviteTokenHash,
      inviteExpiresAt: data.inviteExpiresAt,
      status: TransactionStatus.WAITING_PARTICIPANT,
      participants: [
        {
          user: data.createdBy,
          role: ParticipantRole.CREATOR,
          status: ParticipantStatus.ACCEPTED,
          invitedAt: now,
          respondedAt: now,
        },
      ],
      statusHistory: [
        {
          status: TransactionStatus.CREATED,
          changedAt: now,
          changedBy: data.createdBy,
          note: `Operación iniciada por el ${initiatorLabel}`,
        },
        {
          status: TransactionStatus.WAITING_PARTICIPANT,
          changedAt: now,
          changedBy: data.createdBy,
          note: waitingNote,
        },
      ],
      evidenceIds: [],
    });
  }

  async findById(id: string): Promise<TransactionDocument | null> {
    return TransactionModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByCode(code: string): Promise<TransactionDocument | null> {
    return TransactionModel.findOne({ code: code.toUpperCase(), deletedAt: null }).exec();
  }

  async findByCodeWithInvite(code: string): Promise<TransactionDocument | null> {
    return TransactionModel.findOne({ code: code.toUpperCase(), deletedAt: null })
      .select(INVITE_SELECT)
      .exec();
  }

  async findByInviteTokenHash(hash: string): Promise<TransactionDocument | null> {
    return TransactionModel.findOne({
      inviteTokenHash: hash,
      deletedAt: null,
    })
      .select(INVITE_SELECT)
      .exec();
  }

  async listForUser(userId: string): Promise<TransactionDocument[]> {
    return TransactionModel.find({
      deletedAt: null,
      $or: [{ createdBy: userId }, { 'participants.user': userId }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async refreshInvite(
    transaction: TransactionDocument,
    inviteTokenHash: string,
    inviteExpiresAt: Date,
  ): Promise<TransactionDocument> {
    transaction.inviteTokenHash = inviteTokenHash;
    transaction.inviteExpiresAt = inviteExpiresAt;
    return transaction.save();
  }

  async addCounterparty(
    transaction: TransactionDocument,
    userId: string,
    note?: string,
  ): Promise<TransactionDocument> {
    const now = new Date();
    transaction.participants.push({
      user: new Types.ObjectId(userId),
      role: ParticipantRole.COUNTERPARTY,
      status: ParticipantStatus.ACCEPTED,
      invitedAt: now,
      respondedAt: now,
    });
    transaction.statusHistory.push({
      status: transaction.status,
      changedAt: now,
      changedBy: new Types.ObjectId(userId),
      note: note ?? 'Contraparte se unió mediante enlace de invitación',
    });
    const saved = await transaction.save();

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.PARTICIPANT_ADDED,
      entityType: 'Transaction',
      entityId: String(saved._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: saved.code,
      metadata: {
        code: saved.code,
        step: 'counterparty_joined',
        role: ParticipantRole.COUNTERPARTY,
        note: note ?? 'join_invite',
        status: saved.status,
      },
    });

    return saved;
  }

  /**
   * Avanza la máquina de estados y registra el evento en el historial.
   */
  async transitionStatus(
    transaction: TransactionDocument,
    to: TransactionStatus,
    data: { userId: string; note: string; clearPendingChanges?: boolean },
  ): Promise<TransactionDocument> {
    const from = transaction.status;
    assertTransition(from, to);
    const now = new Date();
    transaction.status = to;
    if (to === TransactionStatus.CANCELLED && !transaction.cancelledAt) {
      transaction.cancelledAt = now;
    }
    if (
      data.clearPendingChanges &&
      (to === TransactionStatus.ACCEPTED || to === TransactionStatus.CANCELLED)
    ) {
      transaction.pendingBuyerChanges = undefined;
      transaction.markModified('pendingBuyerChanges');
    }
    transaction.statusHistory.push({
      status: to,
      changedAt: now,
      changedBy: new Types.ObjectId(data.userId),
      note: data.note,
    });
    const saved = await transaction.save();

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: data.userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Transaction',
      entityId: String(saved._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: saved.code,
      metadata: {
        code: saved.code,
        step: 'status_change',
        from,
        to,
        note: data.note,
      },
    });

    return saved;
  }

  async acceptPurchase(
    transaction: TransactionDocument,
    userId: string,
    partyBuyer: TransactionPartyInstructions | undefined,
    operationDeadlineAt: Date,
    feePayer?: string,
  ): Promise<TransactionDocument> {
    const now = new Date();
    const userOid = new Types.ObjectId(userId);
    const alreadyParticipant = transaction.participants.some(
      (p) => String(p.user) === userId,
    );

    if (!alreadyParticipant) {
      transaction.participants.push({
        user: userOid,
        role: ParticipantRole.COUNTERPARTY,
        status: ParticipantStatus.ACCEPTED,
        invitedAt: now,
        respondedAt: now,
      });
    }

    if (partyBuyer) {
      if (!transaction.party) transaction.party = {};
      transaction.party.buyer = partyBuyer;
      transaction.markModified('party');
    }

    if (feePayer) {
      transaction.feePayer = feePayer as ITransaction['feePayer'];
    }

    transaction.operationDeadlineAt = operationDeadlineAt;

    assertTransition(transaction.status, TransactionStatus.ACCEPTED);
    const from = transaction.status;
    transaction.status = TransactionStatus.ACCEPTED;
    transaction.statusHistory.push({
      status: TransactionStatus.ACCEPTED,
      changedAt: now,
      changedBy: userOid,
      note: 'Comprador aceptó la compra — acuerdo cerrado, pendiente de pago',
    });
    const saved = await transaction.save();
    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Transaction',
      entityId: String(saved._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: saved.code,
      metadata: {
        code: saved.code,
        step: 'accept_purchase',
        from,
        to: TransactionStatus.ACCEPTED,
        note: 'accept_purchase',
        participantAdded: !alreadyParticipant,
        operationDeadlineAt: operationDeadlineAt.toISOString(),
      },
    });
    if (!alreadyParticipant) {
      auditService.track({
        actor: userId,
        action: AuditAction.PARTICIPANT_ADDED,
        entityType: 'Transaction',
        entityId: String(saved._id),
        outcome: AuditOutcome.SUCCESS,
        correlationId: saved.code,
        metadata: {
          code: saved.code,
          step: 'accept_purchase',
          role: ParticipantRole.COUNTERPARTY,
        },
      });
    }
    return saved;
  }

  async confirmSellerSale(
    transaction: TransactionDocument,
    data: {
      userId: string;
      productId: string;
      amountCents: number;
      currency: string;
      feePayer: string;
      alreadyParticipant: boolean;
      partySeller?: TransactionPartyInstructions;
      returnInstructions?: string;
      targetStatus: typeof TransactionStatus.ACCEPTED | typeof TransactionStatus.PENDING_BUYER_CONFIRM;
      pendingBuyerChanges?: Array<{ field: string; from: string; to: string }>;
      operationDeadlineAt: Date;
    },
  ): Promise<TransactionDocument> {
    const now = new Date();
    const userOid = new Types.ObjectId(data.userId);

    if (!data.alreadyParticipant) {
      transaction.participants.push({
        user: userOid,
        role: ParticipantRole.COUNTERPARTY,
        status: ParticipantStatus.ACCEPTED,
        invitedAt: now,
        respondedAt: now,
      });
    }

    transaction.product = new Types.ObjectId(data.productId);
    transaction.amountCents = data.amountCents;
    transaction.currency = data.currency;
    transaction.feePayer = data.feePayer as ITransaction['feePayer'];
    transaction.operationDeadlineAt = data.operationDeadlineAt;

    if (data.partySeller) {
      if (!transaction.party) transaction.party = {};
      transaction.party.seller = data.partySeller;
      transaction.markModified('party');
    }
    if (data.returnInstructions?.trim()) {
      transaction.returnInstructions = data.returnInstructions.trim();
    }

    if (data.pendingBuyerChanges?.length) {
      transaction.pendingBuyerChanges = data.pendingBuyerChanges;
      transaction.markModified('pendingBuyerChanges');
    } else {
      transaction.pendingBuyerChanges = undefined;
    }

    const to = data.targetStatus;
    const from = transaction.status;
    assertTransition(transaction.status, to);
    transaction.status = to;
    transaction.statusHistory.push({
      status: to,
      changedAt: now,
      changedBy: userOid,
      note:
        to === TransactionStatus.PENDING_BUYER_CONFIRM
          ? 'Vendedor confirmó con cambios — pendiente de reconfirmación del comprador'
          : 'Vendedor confirmó la venta — acuerdo cerrado, pendiente de pago',
    });

    const saved = await transaction.save();
    const { auditService, AuditAction, AuditOutcome } = await import('../audit');

    auditService.track({
      actor: data.userId,
      action: AuditAction.UPDATE,
      entityType: 'Transaction',
      entityId: String(saved._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: saved.code,
      metadata: {
        code: saved.code,
        step: 'confirm_seller_sale',
        productId: data.productId,
        amountCents: data.amountCents,
        currency: data.currency,
        hasVariation: Boolean(data.pendingBuyerChanges?.length),
        changes: data.pendingBuyerChanges,
        operationDeadlineAt: data.operationDeadlineAt.toISOString(),
      },
    });

    auditService.track({
      actor: data.userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'Transaction',
      entityId: String(saved._id),
      outcome: AuditOutcome.SUCCESS,
      correlationId: saved.code,
      metadata: {
        code: saved.code,
        step: 'confirm_seller_sale',
        from,
        to,
        note: 'confirm_seller_sale',
      },
    });

    if (!data.alreadyParticipant) {
      auditService.track({
        actor: data.userId,
        action: AuditAction.PARTICIPANT_ADDED,
        entityType: 'Transaction',
        entityId: String(saved._id),
        outcome: AuditOutcome.SUCCESS,
        correlationId: saved.code,
        metadata: {
          code: saved.code,
          step: 'confirm_seller_sale',
          role: ParticipantRole.COUNTERPARTY,
        },
      });
    }

    return saved;
  }

  async codeExists(code: string): Promise<boolean> {
    const count = await TransactionModel.countDocuments({ code }).exec();
    return count > 0;
  }

  async findExpiredOperational(limit = 50): Promise<TransactionDocument[]> {
    const now = new Date();
    return TransactionModel.find({
      deletedAt: null,
      operationDeadlineAt: { $lte: now },
      status: {
        $in: [
          TransactionStatus.PENDING_BUYER_CONFIRM,
          TransactionStatus.ACCEPTED,
          TransactionStatus.FUNDED,
          TransactionStatus.IN_PROGRESS,
        ],
      },
    })
      .limit(limit)
      .exec();
  }
}
