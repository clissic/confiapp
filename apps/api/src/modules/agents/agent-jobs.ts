import {
  ParticipantRole,
  ParticipantStatus,
  TransactionStatus,
} from '@confiapp/database';
import { Types } from 'mongoose';

import { TransactionModel } from '../../database/models';

/** Statuses de operación que siguen “activos” para un intermediario. */
export const ACTIVE_AGENT_JOB_STATUSES: TransactionStatus[] = [
  TransactionStatus.WAITING_PARTICIPANT,
  TransactionStatus.ACCEPTED,
  TransactionStatus.FUNDED,
  TransactionStatus.IN_PROGRESS,
  TransactionStatus.DISPUTED,
];

export interface AgentActiveJobSummary {
  id: string;
  code: string;
  title: string;
  status: TransactionStatus;
}

function agentOid(agentId: string): Types.ObjectId | string {
  return Types.ObjectId.isValid(agentId) ? new Types.ObjectId(agentId) : agentId;
}

/** Match: intermediario ACCEPTED en ops no terminales. */
export function activeAgentJobFilter(agentId: string) {
  return {
    deletedAt: null,
    status: { $in: ACTIVE_AGENT_JOB_STATUSES },
    participants: {
      $elemMatch: {
        user: agentOid(agentId),
        role: ParticipantRole.INTERMEDIARY,
        status: ParticipantStatus.ACCEPTED,
      },
    },
  };
}

export async function countActiveAgentJobs(agentId: string): Promise<number> {
  return TransactionModel.countDocuments(activeAgentJobFilter(agentId)).exec();
}

export async function listActiveAgentJobs(
  agentId: string,
  limit = 20,
): Promise<AgentActiveJobSummary[]> {
  const rows = await TransactionModel.find(activeAgentJobFilter(agentId))
    .select('code title status')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return rows.map((tx) => ({
    id: String(tx._id),
    code: tx.code,
    title: tx.title,
    status: tx.status as TransactionStatus,
  }));
}

/** Batch count (búsqueda de agentes). Solo intermediarios ACCEPTED. */
export async function countActiveJobsForAgents(
  agentIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(agentIds.map((id) => [id, 0]));
  if (!agentIds.length) return counts;

  const oids = agentIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const rows = await TransactionModel.aggregate<{ _id: unknown; count: number }>([
    {
      $match: {
        deletedAt: null,
        status: { $in: ACTIVE_AGENT_JOB_STATUSES },
        participants: {
          $elemMatch: {
            role: ParticipantRole.INTERMEDIARY,
            status: ParticipantStatus.ACCEPTED,
            user: { $in: oids },
          },
        },
      },
    },
    { $unwind: '$participants' },
    {
      $match: {
        'participants.role': ParticipantRole.INTERMEDIARY,
        'participants.status': ParticipantStatus.ACCEPTED,
        'participants.user': { $in: oids },
      },
    },
    { $group: { _id: '$participants.user', count: { $sum: 1 } } },
  ]).exec();

  for (const row of rows) {
    counts.set(String(row._id), row.count);
  }
  return counts;
}
