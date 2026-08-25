import {
  DisputeModel,
  DisputeStatus,
  PaymentModel,
  PaymentStatus,
  PaymentType,
  TransactionModel,
  TransactionStatus,
} from '@confiapp/database';
import { Types } from 'mongoose';

import { paymentProvider } from '../../infrastructure/payments/mercadopago.payment-provider';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { agentCommissionService } from '../finance/commission.service';
import { financialAudit } from '../finance/financial-audit.service';
import { assertTransition } from '../transactions/state-machine';

import type { DisputesStatusDto } from './dto';
import { DisputesRepository } from './repository';

export class DisputesService {
  constructor(private readonly repository = new DisputesRepository()) {}

  async getStatus(): Promise<DisputesStatusDto> {
    void this.repository;
    return { module: 'disputes', status: 'ready' };
  }

  async openDispute(input: {
    userId: string;
    transactionCode: string;
    reason: string;
  }) {
    const tx = await TransactionModel.findOne({
      code: input.transactionCode,
      deletedAt: null,
    }).exec();
    if (!tx) throw new NotFoundError('Operación no encontrada');

    assertTransition(tx.status, TransactionStatus.DISPUTED);
    tx.status = TransactionStatus.DISPUTED;
    tx.disputedAt = new Date();
    await tx.save();

    const dispute = await DisputeModel.create({
      transaction: tx._id,
      openedBy: new Types.ObjectId(input.userId),
      status: DisputeStatus.OPEN,
      reason: input.reason.trim().slice(0, 500),
    });

    await agentCommissionService.setDisputeBlocked(String(tx._id), true);

    await financialAudit.record({
      action: 'DISPUTE_OPENED',
      idempotencyKey: `fa:dispute-open:${String(dispute._id)}`,
      operationId: String(tx._id),
      actorId: input.userId,
      metadata: { reason: input.reason },
      newStatus: DisputeStatus.OPEN,
    });

    return {
      id: String(dispute._id),
      transactionCode: tx.code,
      status: dispute.status,
    };
  }

  async resolveDispute(input: {
    adminId: string;
    disputeId: string;
    outcome: 'RESUME' | 'CANCEL' | 'COMPLETE_WITH_REFUND';
    notes?: string;
  }) {
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

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolutionNote = input.notes?.trim().slice(0, 1000);
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = new Types.ObjectId(input.adminId);
    await dispute.save();

    if (input.outcome === 'RESUME') {
      assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
      tx.status = TransactionStatus.IN_PROGRESS;
      await tx.save();
      await agentCommissionService.setDisputeBlocked(String(tx._id), false);
    } else if (input.outcome === 'CANCEL') {
      assertTransition(tx.status, TransactionStatus.CANCELLED);
      tx.status = TransactionStatus.CANCELLED;
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
        hold.refundedAt = new Date();
        await hold.save();
      }
      await agentCommissionService.reverseForTransaction(
        String(tx._id),
        'REFUND_TOTAL',
      );
      assertTransition(tx.status, TransactionStatus.CANCELLED);
      tx.status = TransactionStatus.CANCELLED;
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

    return {
      id: String(dispute._id),
      status: dispute.status,
      transactionStatus: tx.status,
    };
  }
}
