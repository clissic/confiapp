import {
  DisputeCategory,
  DisputeStatus,
  type IDispute,
  type ITransaction,
} from '@confiapp/database';
import type { FilterQuery } from 'mongoose';

import { DisputeModel } from '../../database/models';

const ACTIVE_STATUSES = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] as const;

type PopulatedUser = {
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type PopulatedDispute = IDispute & {
  _id: unknown;
  transaction?: Pick<ITransaction, 'code' | 'status' | 'title'> & { _id?: unknown };
  openedBy?: PopulatedUser;
  resolvedBy?: PopulatedUser;
};

export class DisputesRepository {
  async findById(id: string) {
    return DisputeModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findActiveByTransaction(transactionId: string) {
    return DisputeModel.findOne({
      transaction: transactionId,
      status: { $in: ACTIVE_STATUSES },
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  async listByTransaction(transactionId: string) {
    return DisputeModel.find({ transaction: transactionId, deletedAt: null }).exec();
  }

  async listAdmin(input: { page: number; limit: number; status?: DisputeStatus }) {
    const filter: FilterQuery<IDispute> = { deletedAt: null };
    if (input.status) {
      filter.status = input.status;
    }

    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      DisputeModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(input.limit)
        .populate<{ transaction: Pick<ITransaction, 'code' | 'status' | 'title'> }>(
          'transaction',
          'code status title',
        )
        .populate<{ openedBy: PopulatedUser }>('openedBy', 'displayName email')
        .lean<PopulatedDispute[]>()
        .exec(),
      DisputeModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async findDetailById(id: string) {
    return DisputeModel.findOne({ _id: id, deletedAt: null })
      .populate<{ transaction: Pick<ITransaction, 'code' | 'status' | 'title'> }>(
        'transaction',
        'code status title',
      )
      .populate<{ openedBy: PopulatedUser }>('openedBy', 'displayName email')
      .populate<{ resolvedBy: PopulatedUser }>('resolvedBy', 'displayName')
      .lean<PopulatedDispute & { _id: unknown }>()
      .exec();
  }
}

export function mapActiveDisputeDto(
  dispute: Pick<IDispute, 'status' | 'reason' | 'category' | 'openedAt'> & { _id: unknown },
): {
  id: string;
  status: DisputeStatus;
  reason: string;
  category?: DisputeCategory;
  openedAt: string;
} {
  return {
    id: String(dispute._id),
    status: dispute.status,
    reason: dispute.reason,
    ...(dispute.category ? { category: dispute.category } : {}),
    openedAt: dispute.openedAt.toISOString(),
  };
}
