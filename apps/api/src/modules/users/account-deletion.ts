import {
  AgentCommissionStatus,
  ParticipantRole,
  PlatformRole,
  TransactionStatus,
  UserStatus,
  WithdrawalStatus,
  type IUser,
} from '@confiapp/database';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_GRACE_DAYS,
  addAccountDeletionGraceDays,
} from '@confiapp/shared';
import { Types, type HydratedDocument } from 'mongoose';

import {
  AgentCommissionModel,
  TransactionModel,
  UserModel,
  WithdrawalModel,
} from '../../database/models';
import { AppError, NotFoundError, ValidationError } from '../../shared/errors/app-error';
import { hashPassword } from '../../utils/password';
import { logger } from '../../utils/logger';
import { AuditAction, AuditOutcome, auditService } from '../audit';
import { AuthRepository } from '../auth/repository';
import { countActiveAgentJobs } from '../agents/agent-jobs';

/** Operaciones no terminales que bloquean baja de comprador/vendedor. */
export const ACTIVE_PARTY_TX_STATUSES: TransactionStatus[] = [
  TransactionStatus.CREATED,
  TransactionStatus.WAITING_PARTICIPANT,
  TransactionStatus.PENDING_BUYER_CONFIRM,
  TransactionStatus.ACCEPTED,
  TransactionStatus.FUNDED,
  TransactionStatus.IN_PROGRESS,
  TransactionStatus.DISPUTED,
];

/** Comisiones aún no liquidadas / no revertidas. */
const OPEN_COMMISSION_STATUSES: AgentCommissionStatus[] = [
  AgentCommissionStatus.PENDING,
  AgentCommissionStatus.AVAILABLE,
  AgentCommissionStatus.RESERVED,
  AgentCommissionStatus.BLOCKED,
];

const OPEN_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.PENDING,
  WithdrawalStatus.PROCESSING,
];

export type AccountDeletionResult = {
  ok: true;
  graceDays: number;
  deletionEffectiveAt: string;
};

export type AccountDeletionBlock = {
  code:
    | 'WALLET_BALANCE'
    | 'OPEN_WITHDRAWALS'
    | 'OPEN_COMMISSIONS'
    | 'ACTIVE_AGENT_JOBS'
    | 'ACTIVE_TRANSACTIONS';
  message: string;
  details?: Record<string, unknown>;
};

function userOid(userId: string): Types.ObjectId | string {
  return Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
}

function isAgentUser(user: Pick<IUser, 'role' | 'roles'>): boolean {
  return (
    user.role === PlatformRole.AGENT || (user.roles ?? []).includes(PlatformRole.AGENT)
  );
}

function walletBalanceCents(user: Pick<IUser, 'wallet'>): number {
  const w = user.wallet;
  return (
    Math.max(0, w?.availableCents ?? 0) +
    Math.max(0, w?.pendingCents ?? 0) +
    Math.max(0, w?.heldCents ?? 0)
  );
}

/** Operaciones activas como comprador/vendedor (no intermediario). */
export async function countActivePartyTransactions(userId: string): Promise<number> {
  const oid = userOid(userId);
  return TransactionModel.countDocuments({
    deletedAt: null,
    status: { $in: ACTIVE_PARTY_TX_STATUSES },
    $or: [
      { createdBy: oid },
      {
        participants: {
          $elemMatch: {
            user: oid,
            role: { $in: [ParticipantRole.CREATOR, ParticipantRole.COUNTERPARTY] },
          },
        },
      },
    ],
  }).exec();
}

export async function countOpenWithdrawals(userId: string): Promise<number> {
  return WithdrawalModel.countDocuments({
    user: userOid(userId),
    status: { $in: OPEN_WITHDRAWAL_STATUSES },
  }).exec();
}

export async function countOpenCommissions(userId: string): Promise<number> {
  return AgentCommissionModel.countDocuments({
    agent: userOid(userId),
    status: { $in: OPEN_COMMISSION_STATUSES },
  }).exec();
}

/**
 * Evalúa todos los bloqueos de baja. Solo server-side; no hay bypass por UI.
 * Se reutiliza en solicitud y en purge definitivo.
 */
export async function evaluateAccountDeletionBlocks(
  user: HydratedDocument<IUser> | IUser,
): Promise<AccountDeletionBlock[]> {
  const userId = String((user as { _id?: unknown })._id ?? '');
  const blocks: AccountDeletionBlock[] = [];

  const balance = walletBalanceCents(user);
  if (balance > 0) {
    blocks.push({
      code: 'WALLET_BALANCE',
      message:
        'No podés eliminar la cuenta mientras tengas saldo en tu wallet (disponible, pendiente o retenido). Retirá o liquidá esos fondos antes de continuar.',
      details: {
        availableCents: user.wallet?.availableCents ?? 0,
        pendingCents: user.wallet?.pendingCents ?? 0,
        heldCents: user.wallet?.heldCents ?? 0,
        totalCents: balance,
      },
    });
  }

  const openWithdrawals = await countOpenWithdrawals(userId);
  if (openWithdrawals > 0) {
    blocks.push({
      code: 'OPEN_WITHDRAWALS',
      message:
        'No podés eliminar la cuenta mientras tengas retiros de wallet pendientes o en proceso.',
      details: { count: openWithdrawals },
    });
  }

  if (isAgentUser(user)) {
    const openCommissions = await countOpenCommissions(userId);
    if (openCommissions > 0) {
      blocks.push({
        code: 'OPEN_COMMISSIONS',
        message:
          'No podés eliminar la cuenta mientras tengas comisiones de agente pendientes, disponibles, reservadas o bloqueadas. Esperá la liquidación o resolución antes de continuar.',
        details: { count: openCommissions },
      });
    }

    const agentJobs = await countActiveAgentJobs(userId);
    if (agentJobs > 0) {
      blocks.push({
        code: 'ACTIVE_AGENT_JOBS',
        message: `No podés eliminar la cuenta: tenés ${agentJobs} trabajo${agentJobs === 1 ? '' : 's'} de agente aceptado${agentJobs === 1 ? '' : 's'} en curso. Completalos o solicitá la salida antes de continuar.`,
        details: { count: agentJobs },
      });
    }
  }

  const partyTx = await countActivePartyTransactions(userId);
  if (partyTx > 0) {
    blocks.push({
      code: 'ACTIVE_TRANSACTIONS',
      message: `No podés eliminar la cuenta: tenés ${partyTx} operación${partyTx === 1 ? '' : 'es'} en curso o en disputa como comprador/vendedor. Cerralas o cancelalas antes de continuar.`,
      details: { count: partyTx },
    });
  }

  return blocks;
}

function throwFirstBlock(blocks: AccountDeletionBlock[]): void {
  const first = blocks[0];
  if (!first) return;
  throw new AppError(409, first.message, { blocks }, first.code);
}

export async function requestAccountDeletion(
  userId: string,
  confirmation: string,
): Promise<AccountDeletionResult> {
  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    throw new ValidationError(
      `Debés escribir exactamente «${ACCOUNT_DELETION_CONFIRMATION}» para confirmar.`,
    );
  }

  const user = await UserModel.findOne({ _id: userId, deletedAt: null }).exec();
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }

  if (user.status === UserStatus.SUSPENDED && user.accountDeletionRequestedAt) {
    const pendingRequestedAt = user.accountDeletionRequestedAt;
    // Idempotente solo si sigue sin bloqueos críticos (p. ej. saldo acreditado en gracia).
    const blocks = await evaluateAccountDeletionBlocks(user);
    if (blocks.length > 0) {
      // Cancelar la baja pendiente: no puede quedar en camino a purge con fondos/trabajos.
      user.status = UserStatus.ACTIVE;
      user.accountDeletionRequestedAt = null;
      await user.save();
      throwFirstBlock(blocks);
    }
    return {
      ok: true,
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
      deletionEffectiveAt: addAccountDeletionGraceDays(pendingRequestedAt).toISOString(),
    };
  }

  const blocks = await evaluateAccountDeletionBlocks(user);
  throwFirstBlock(blocks);

  const requestedAt = new Date();

  // Condición atómica: evita carrera si el wallet se acredita entre check y save.
  const updated = await UserModel.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
      status: UserStatus.ACTIVE,
      accountDeletionRequestedAt: null,
      'wallet.availableCents': { $lte: 0 },
      'wallet.pendingCents': { $lte: 0 },
      'wallet.heldCents': { $lte: 0 },
    },
    {
      $set: {
        status: UserStatus.SUSPENDED,
        accountDeletionRequestedAt: requestedAt,
      },
    },
    { new: true },
  ).exec();

  if (!updated) {
    // Releer y devolver el bloqueo real (wallet race u otro estado).
    const fresh = await UserModel.findOne({ _id: userId, deletedAt: null }).exec();
    if (!fresh) throw new NotFoundError('Usuario no encontrado');
    const retryBlocks = await evaluateAccountDeletionBlocks(fresh);
    if (retryBlocks.length > 0) throwFirstBlock(retryBlocks);
    throw new AppError(
      409,
      'No se pudo iniciar la eliminación de la cuenta. Probá de nuevo en unos segundos.',
      undefined,
      'DELETE_RACE',
    );
  }

  // Revalidar trabajos/comisiones tras el update (no van en el filtro atómico).
  const postBlocks = await evaluateAccountDeletionBlocks(updated);
  if (postBlocks.length > 0) {
    updated.status = UserStatus.ACTIVE;
    updated.accountDeletionRequestedAt = null;
    await updated.save();
    throwFirstBlock(postBlocks);
  }

  const authRepo = new AuthRepository();
  await authRepo.revokeAllRefreshTokensForUser(userId);

  auditService.track({
    actor: userId,
    action: AuditAction.STATUS_CHANGE,
    entityType: 'User',
    entityId: userId,
    outcome: AuditOutcome.SUCCESS,
    metadata: {
      reason: 'account_deletion_requested',
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
      accountDeletionRequestedAt: requestedAt.toISOString(),
    },
  });

  logger.info('account.deletion_requested', { userId });

  return {
    ok: true,
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    deletionEffectiveAt: addAccountDeletionGraceDays(requestedAt).toISOString(),
  };
}

/** Anonimiza PII y marca deletedAt; conserva _id para FKs históricas. */
export async function anonymizeDeletedUser(
  user: HydratedDocument<IUser>,
): Promise<void> {
  const id = String(user._id);
  const unusableHash = await hashPassword(`deleted:${id}:${Date.now()}:${Math.random()}`);

  user.email = `deleted_${id}@deleted.local`;
  user.passwordHash = unusableHash;
  user.fullName = 'Cuenta eliminada';
  user.set('displayName', undefined);
  user.set('phone', undefined);
  user.set('documentNumber', undefined);
  user.set('bio', undefined);
  user.set('avatar', undefined);
  user.set('dateOfBirth', undefined);
  user.photos = [];
  user.payoutMethods = [];
  user.status = UserStatus.SUSPENDED;
  user.deletedAt = new Date();
  user.accountDeletionRequestedAt = user.accountDeletionRequestedAt ?? new Date();
  user.set('emailVerificationTokenHash', undefined);
  user.set('emailVerificationExpires', undefined);
  user.set('passwordResetTokenHash', undefined);
  user.set('passwordResetExpires', undefined);
  user.set('phoneVerifiedAt', undefined);
  user.set('emailVerifiedAt', undefined);
  user.set('idDigital', undefined);

  if (user.location) {
    user.set('location.label', undefined);
    user.set('location.point', undefined);
    user.set('location.address', {});
  }

  if (user.schedule) {
    user.schedule.isAcceptingAssignments = false;
  }

  await user.save();
}

const PURGE_BATCH = 50;

/** Procesa bajas cuya gracia ya venció. Revalida bloqueos; no fuerza purge. */
export async function purgeExpiredAccountDeletions(
  limit = PURGE_BATCH,
  now: Date = new Date(),
): Promise<number> {
  const threshold = new Date(now.getTime());
  threshold.setUTCDate(threshold.getUTCDate() - ACCOUNT_DELETION_GRACE_DAYS);

  const users = await UserModel.find({
    deletedAt: null,
    status: UserStatus.SUSPENDED,
    accountDeletionRequestedAt: { $ne: null, $lte: threshold },
  })
    .select('+passwordHash')
    .limit(limit)
    .exec();

  let purged = 0;
  const authRepo = new AuthRepository();

  for (const user of users) {
    const userId = String(user._id);
    try {
      const blocks = await evaluateAccountDeletionBlocks(user);
      if (blocks.length > 0) {
        logger.warn('account.deletion_purge_blocked', {
          userId,
          codes: blocks.map((b) => b.code),
        });
        auditService.track({
          actor: userId,
          action: AuditAction.SYSTEM,
          entityType: 'User',
          entityId: userId,
          outcome: AuditOutcome.FAILURE,
          metadata: {
            reason: 'account_deletion_purge_blocked',
            blocks: blocks.map((b) => ({ code: b.code, details: b.details })),
          },
        });
        continue;
      }

      await anonymizeDeletedUser(user);
      await authRepo.revokeAllRefreshTokensForUser(userId);
      auditService.track({
        actor: userId,
        action: AuditAction.DELETE,
        entityType: 'User',
        entityId: userId,
        outcome: AuditOutcome.SUCCESS,
        metadata: { reason: 'account_deletion_grace_expired' },
      });
      purged += 1;
      logger.info('account.deletion_purged', { userId });
    } catch (error) {
      logger.error('account.deletion_purge_failed', { userId, error });
    }
  }

  return purged;
}
