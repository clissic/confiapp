import {
  AgentCommissionModel,
  AgentCommissionStatus,
  AgentPayoutModel,
  AgentPayoutStatus,
  PayoutBatchModel,
  PayoutBatchStatus,
  WalletMovementDirection,
  WalletMovementType,
} from '@confiapp/database';
import { isWithinAgentPayoutWindow } from '@confiapp/shared';
import { Types } from 'mongoose';

import { UserModel } from '../../database/models';
import { payoutProvider } from '../../infrastructure/payments/payout-provider';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { walletLedger } from '../wallet/service';

import { agentCommissionService } from './commission.service';
import { financialAudit } from './financial-audit.service';

function batchDto(doc: {
  _id: Types.ObjectId;
  createdBy: Types.ObjectId;
  totalAmountCents: number;
  currency: string;
  numberOfPayouts: number;
  status: PayoutBatchStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    createdBy: String(doc.createdBy),
    totalAmountCents: doc.totalAmountCents,
    currency: doc.currency,
    numberOfPayouts: doc.numberOfPayouts,
    status: doc.status,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function payoutDto(doc: {
  _id: Types.ObjectId;
  batch: Types.ObjectId;
  agent: Types.ObjectId;
  amountCents: number;
  currency: string;
  status: AgentPayoutStatus;
  commissionIds: Types.ObjectId[];
  transferDate?: Date;
  transferReference?: string;
  paymentMethod?: string;
  proofUrl?: string;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
}) {
  return {
    id: String(doc._id),
    batchId: String(doc.batch),
    agentId: String(doc.agent),
    amountCents: doc.amountCents,
    currency: doc.currency,
    status: doc.status,
    commissionIds: doc.commissionIds.map(String),
    transferDate: doc.transferDate?.toISOString(),
    transferReference: doc.transferReference,
    paymentMethod: doc.paymentMethod,
    proofUrl: doc.proofUrl,
    processedBy: doc.processedBy ? String(doc.processedBy) : undefined,
    processedAt: doc.processedAt?.toISOString(),
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
  };
}

export class PayoutService {
  async createBatchFromAvailable(input: {
    adminId: string;
    agentIds?: string[];
    notes?: string;
    allowOutsideWindow?: boolean;
  }) {
    if (!isWithinAgentPayoutWindow() && !input.allowOutsideWindow) {
      throw new ValidationError(
        'Las liquidaciones de agentes se realizan del 1 al 10 de cada mes. Marcá la casilla «Liquidar fuera del período 1–10» y dejá una nota explicativa para continuar.',
      );
    }
    if (!isWithinAgentPayoutWindow() && input.allowOutsideWindow && !input.notes?.trim()) {
      throw new ValidationError(
        'Si liquidás fuera del 1 al 10, tenés que escribir una nota explicativa en el campo de notas.',
      );
    }

    const available = await agentCommissionService.listAvailableForPayout(input.agentIds);
    if (!available.length) {
      throw new ValidationError('No hay comisiones AVAILABLE para liquidar');
    }

    const byAgent = new Map<string, typeof available>();
    for (const c of available) {
      const key = String(c.agent);
      const list = byAgent.get(key) ?? [];
      list.push(c);
      byAgent.set(key, list);
    }

    let totalAmountCents = 0;
    for (const list of byAgent.values()) {
      totalAmountCents += list.reduce((sum, c) => sum + c.agentShareCents, 0);
    }

    const batch = await PayoutBatchModel.create({
      createdBy: new Types.ObjectId(input.adminId),
      totalAmountCents,
      currency: 'UYU',
      numberOfPayouts: byAgent.size,
      status: PayoutBatchStatus.PENDING_TRANSFER,
      notes: input.notes,
    });

    const payouts = [];
    for (const [agentId, commissions] of byAgent) {
      const amountCents = commissions.reduce((sum, c) => sum + c.agentShareCents, 0);
      const commissionIds = commissions.map((c) => c._id);
      const idempotencyKey = `payout:${String(batch._id)}:${agentId}`;

      const reserved = await AgentCommissionModel.updateMany(
        {
          _id: { $in: commissionIds },
          status: AgentCommissionStatus.AVAILABLE,
          deletedAt: null,
        },
        {
          $set: {
            status: AgentCommissionStatus.RESERVED,
            payoutBatch: batch._id,
          },
        },
      ).exec();

      if (reserved.modifiedCount !== commissionIds.length) {
        throw new ValidationError(
          'Concurrencia: alguna comisión ya no está AVAILABLE. Reintentá el batch.',
        );
      }

      const providerResult = await payoutProvider.createPayout({
        agentId,
        amountCents,
        currency: 'UYU',
        commissionIds: commissionIds.map(String),
        batchId: String(batch._id),
        notes: input.notes,
      });

      const payout = await AgentPayoutModel.create({
        batch: batch._id,
        agent: new Types.ObjectId(agentId),
        amountCents,
        currency: 'UYU',
        status: AgentPayoutStatus.PENDING,
        commissionIds,
        notes: input.notes,
        idempotencyKey,
      });

      await AgentCommissionModel.updateMany(
        { _id: { $in: commissionIds } },
        { $set: { payout: payout._id } },
      ).exec();

      await walletLedger.record({
        userId: agentId,
        type: WalletMovementType.PAYOUT_RESERVED,
        direction: WalletMovementDirection.DEBIT,
        amountCents,
        currency: 'UYU',
        description: `Reserva liquidación batch ${String(batch._id)}`,
        metadata: {
          batchId: String(batch._id),
          payoutId: String(payout._id),
        },
      });

      // Disponible contable → se reserva (sale de available en wallet user).
      await UserModel.updateOne(
        { _id: agentId },
        {
          $inc: { 'wallet.availableCents': -amountCents },
          $set: { 'wallet.lastMovementAt': new Date() },
        },
      ).exec();

      await financialAudit.record({
        action: 'PAYOUT_RESERVED',
        idempotencyKey: `fa:${idempotencyKey}`,
        agentId,
        payoutId: String(payout._id),
        payoutBatchId: String(batch._id),
        actorId: input.adminId,
        actorRole: 'ADMIN',
        amountCents,
        currency: 'UYU',
        newStatus: AgentPayoutStatus.PENDING,
      });

      payouts.push(payoutDto(payout.toObject()));
    }

    await financialAudit.record({
      action: 'PAYOUT_BATCH_CREATED',
      idempotencyKey: `fa:batch:${String(batch._id)}`,
      payoutBatchId: String(batch._id),
      actorId: input.adminId,
      actorRole: 'ADMIN',
      amountCents: totalAmountCents,
      currency: 'UYU',
      newStatus: PayoutBatchStatus.PENDING_TRANSFER,
    });

    return { batch: batchDto(batch.toObject()), payouts };
  }

  async confirmPayout(input: {
    adminId: string;
    payoutId: string;
    transferReference: string;
    transferDate?: string;
    paymentMethod?: string;
    proofUrl?: string;
    notes?: string;
  }) {
    const payout = await AgentPayoutModel.findOne({
      _id: input.payoutId,
      deletedAt: null,
    }).exec();
    if (!payout) throw new NotFoundError('Payout no encontrado');
    if (
      payout.status === AgentPayoutStatus.PAID ||
      payout.status === AgentPayoutStatus.CANCELLED
    ) {
      throw new ValidationError(`Payout ya está en estado ${payout.status}`);
    }

    const now = new Date();
    payout.status = AgentPayoutStatus.PAID;
    payout.transferReference = input.transferReference.trim();
    payout.transferDate = input.transferDate ? new Date(input.transferDate) : now;
    payout.paymentMethod = input.paymentMethod;
    payout.proofUrl = input.proofUrl;
    payout.notes = input.notes ?? payout.notes;
    payout.processedBy = new Types.ObjectId(input.adminId);
    payout.processedAt = now;
    await payout.save();

    await AgentCommissionModel.updateMany(
      { _id: { $in: payout.commissionIds }, deletedAt: null },
      { $set: { status: AgentCommissionStatus.PAID } },
    ).exec();

    await walletLedger.record({
      userId: String(payout.agent),
      type: WalletMovementType.PAYOUT_COMPLETED,
      direction: WalletMovementDirection.DEBIT,
      amountCents: payout.amountCents,
      currency: payout.currency,
      description: `Liquidación confirmada · ${payout.transferReference}`,
      metadata: {
        payoutId: String(payout._id),
        batchId: String(payout.batch),
      },
    });

    await financialAudit.record({
      action: 'PAYOUT_COMPLETED',
      idempotencyKey: `fa:payout-paid:${String(payout._id)}`,
      agentId: String(payout.agent),
      payoutId: String(payout._id),
      payoutBatchId: String(payout.batch),
      actorId: input.adminId,
      actorRole: 'ADMIN',
      amountCents: payout.amountCents,
      currency: payout.currency,
      previousStatus: AgentPayoutStatus.PENDING,
      newStatus: AgentPayoutStatus.PAID,
      metadata: {
        transferReference: payout.transferReference,
        proofUrl: payout.proofUrl,
      },
    });

    await this.refreshBatchStatus(String(payout.batch));
    return payoutDto(payout.toObject());
  }

  private async refreshBatchStatus(batchId: string) {
    const payouts = await AgentPayoutModel.find({
      batch: new Types.ObjectId(batchId),
      deletedAt: null,
    })
      .select('status')
      .lean()
      .exec();
    if (!payouts.length) return;

    const paid = payouts.filter((p) => p.status === AgentPayoutStatus.PAID).length;
    const cancelled = payouts.filter((p) => p.status === AgentPayoutStatus.CANCELLED).length;
    let status: PayoutBatchStatus = PayoutBatchStatus.PENDING_TRANSFER;
    if (paid === payouts.length) status = PayoutBatchStatus.PAID;
    else if (cancelled === payouts.length) status = PayoutBatchStatus.CANCELLED;
    else if (paid > 0) status = PayoutBatchStatus.PARTIALLY_PAID;

    await PayoutBatchModel.updateOne(
      { _id: batchId },
      { $set: { status } },
    ).exec();
  }

  async listBatches(limit = 40) {
    const items = await PayoutBatchModel.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Math.max(1, limit)))
      .lean()
      .exec();
    return items.map(batchDto);
  }

  async getBatch(batchId: string) {
    const batch = await PayoutBatchModel.findOne({
      _id: batchId,
      deletedAt: null,
    }).lean();
    if (!batch) throw new NotFoundError('Batch no encontrado');
    const payouts = await AgentPayoutModel.find({
      batch: batch._id,
      deletedAt: null,
    })
      .lean()
      .exec();
    return { batch: batchDto(batch), payouts: payouts.map(payoutDto) };
  }

  async listPayoutsForAgent(agentId: string, requesterId: string, isAdmin: boolean) {
    if (!isAdmin && agentId !== requesterId) {
      throw new ForbiddenError('No podés ver liquidaciones de otro agente');
    }
    const items = await AgentPayoutModel.find({
      agent: new Types.ObjectId(agentId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
    return items.map(payoutDto);
  }
}

export const payoutService = new PayoutService();
