import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import {
  ParticipantRole,
  ParticipantStatus,
  TransactionInitiator,
  TransactionStatus,
  type ITransaction,
} from '@confiapp/database';

import { TransactionModel } from '../../database/models';
import { assertTransition } from './state-machine';

export type TransactionDocument = HydratedDocument<ITransaction>;

const INVITE_SELECT = '+inviteTokenHash';

export class TransactionsRepository {
  async create(data: {
    code: string;
    title: string;
    description?: string;
    createdBy: string;
    initiatedBy: TransactionInitiator;
    productId?: string;
    meetingLocation?: {
      type: 'Point';
      coordinates: [number, number];
      label?: string;
    };
    conditions: { summary: string; checklist?: string[] };
    amountCents: number;
    currency: string;
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

    return TransactionModel.create({
      code: data.code,
      title: data.title,
      description: data.description,
      createdBy: data.createdBy,
      initiatedBy: data.initiatedBy,
      product: data.productId,
      meetingLocation: data.meetingLocation,
      conditions: data.conditions,
      amountCents: data.amountCents,
      currency: data.currency,
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
        role: ParticipantRole.COUNTERPARTY,
        note: note ?? 'join_invite',
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
    data: { userId: string; note: string },
  ): Promise<TransactionDocument> {
    const from = transaction.status;
    assertTransition(from, to);
    const now = new Date();
    transaction.status = to;
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
      metadata: { from, to, note: data.note, code: saved.code },
    });

    return saved;
  }

  async acceptPurchase(
    transaction: TransactionDocument,
    userId: string,
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

    assertTransition(transaction.status, TransactionStatus.ACCEPTED);
    const from = transaction.status;
    transaction.status = TransactionStatus.ACCEPTED;
    transaction.statusHistory.push({
      status: TransactionStatus.ACCEPTED,
      changedAt: now,
      changedBy: userOid,
      note: 'Comprador aceptó la compra — acuerdo cerrado, pendiente de fondeo',
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
        from,
        to: TransactionStatus.ACCEPTED,
        note: 'accept_purchase',
        participantAdded: !alreadyParticipant,
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
        metadata: { role: ParticipantRole.COUNTERPARTY },
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
      alreadyParticipant: boolean;
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

    // Ambas partes + producto → acuerdo aceptado automáticamente.
    const from = transaction.status;
    assertTransition(transaction.status, TransactionStatus.ACCEPTED);
    transaction.status = TransactionStatus.ACCEPTED;
    transaction.statusHistory.push({
      status: TransactionStatus.ACCEPTED,
      changedAt: now,
      changedBy: userOid,
      note: 'Vendedor confirmó la venta — acuerdo cerrado, pendiente de fondeo',
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
      metadata: { from, to: TransactionStatus.ACCEPTED, note: 'confirm_seller_sale' },
    });
    return saved;
  }

  async codeExists(code: string): Promise<boolean> {
    const count = await TransactionModel.countDocuments({ code }).exec();
    return count > 0;
  }
}
