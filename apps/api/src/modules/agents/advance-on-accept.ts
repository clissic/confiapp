import { TransactionStatus, type ITransaction } from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

import { assertTransition } from '../transactions/state-machine';

/**
 * Tras el pago protegido, la aceptación del agente avanza la operación a "En curso".
 * Si aún no está FUNDED (o ya está IN_PROGRESS), no modifica el status.
 */
export function advanceToInProgressOnAgentAccept(
  tx: HydratedDocument<ITransaction>,
  agentId: string,
  now: Date,
  note = 'Operación en curso: agente asignado tras el pago protegido',
): boolean {
  if (tx.status !== TransactionStatus.FUNDED) return false;
  assertTransition(tx.status, TransactionStatus.IN_PROGRESS);
  tx.status = TransactionStatus.IN_PROGRESS;
  tx.statusHistory.push({
    status: TransactionStatus.IN_PROGRESS,
    changedAt: now,
    changedBy: new Types.ObjectId(agentId),
    note,
  });
  return true;
}
