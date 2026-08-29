import {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from '@confiapp/database';
import { Types } from 'mongoose';

import { PaymentModel } from '../../database/models';

export type ManualPrexEscrowGate = {
  provider: string;
  status: string;
  hasReceipt: boolean;
  adminConfirmedAt?: string;
};

export function isManualPrexAdminConfirmed(
  status: string,
  metadata?: Record<string, unknown>,
): boolean {
  if (status === PaymentStatus.CAPTURED || status === PaymentStatus.RELEASED) {
    return true;
  }
  return Boolean(metadata?.adminConfirmedAt);
}

/** Agentes solo ven trabajos con transferencia Prex revisada y confirmada por admin. */
export function isEscrowVisibleToAgents(gate: ManualPrexEscrowGate | null | undefined): boolean {
  if (!gate) return true;
  if (gate.provider !== PaymentProvider.MANUAL_PREX) return true;
  if (gate.status === PaymentStatus.CAPTURED || gate.status === PaymentStatus.RELEASED) {
    return true;
  }
  if (gate.status === PaymentStatus.REQUIRES_ACTION && gate.hasReceipt) {
    return false;
  }
  return true;
}

export async function loadManualPrexEscrowGate(
  transactionId: string,
): Promise<ManualPrexEscrowGate | null> {
  if (!Types.ObjectId.isValid(transactionId)) return null;
  const hold = await PaymentModel.findOne({
    transaction: transactionId,
    type: PaymentType.ESCROW_HOLD,
    provider: PaymentProvider.MANUAL_PREX,
    deletedAt: null,
  })
    .select('provider status metadata')
    .lean()
    .exec();
  if (!hold) return null;
  const meta = (hold.metadata ?? {}) as Record<string, unknown>;
  const receiptDataUrl =
    typeof meta.receiptDataUrl === 'string' ? meta.receiptDataUrl : undefined;
  return {
    provider: hold.provider,
    status: hold.status,
    hasReceipt: Boolean(receiptDataUrl),
    adminConfirmedAt:
      typeof meta.adminConfirmedAt === 'string' ? meta.adminConfirmedAt : undefined,
  };
}

export async function loadManualPrexEscrowGates(
  transactionIds: string[],
): Promise<Map<string, ManualPrexEscrowGate>> {
  const validIds = transactionIds.filter((id) => Types.ObjectId.isValid(id));
  if (validIds.length === 0) return new Map();

  const holds = await PaymentModel.find({
    transaction: { $in: validIds },
    type: PaymentType.ESCROW_HOLD,
    provider: PaymentProvider.MANUAL_PREX,
    deletedAt: null,
  })
    .select('transaction provider status metadata')
    .lean()
    .exec();

  const map = new Map<string, ManualPrexEscrowGate>();
  for (const hold of holds) {
    const meta = (hold.metadata ?? {}) as Record<string, unknown>;
    const receiptDataUrl =
      typeof meta.receiptDataUrl === 'string' ? meta.receiptDataUrl : undefined;
    map.set(String(hold.transaction), {
      provider: hold.provider,
      status: hold.status,
      hasReceipt: Boolean(receiptDataUrl),
      adminConfirmedAt:
        typeof meta.adminConfirmedAt === 'string' ? meta.adminConfirmedAt : undefined,
    });
  }
  return map;
}
