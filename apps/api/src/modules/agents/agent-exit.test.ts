import {
  AgentOnboardingStatus,
  ParticipantRole,
  ParticipantStatus,
  PlatformRole,
  TransactionStatus,
} from '@confiapp/database';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../shared/errors/app-error';

vi.mock('../../database/models', () => ({
  TransactionModel: {
    countDocuments: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    aggregate: vi.fn(),
  },
  UserModel: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../audit', () => ({
  AuditAction: {
    STATUS_CHANGE: 'STATUS_CHANGE',
    ROLE_CHANGED: 'ROLE_CHANGED',
    AGENT_REASSIGNED: 'AGENT_REASSIGNED',
    PARTICIPANT_UPDATED: 'PARTICIPANT_UPDATED',
  },
  AuditOutcome: { SUCCESS: 'SUCCESS' },
  auditService: { track: vi.fn() },
  buildAuditUpdatePayload: vi.fn((changes: unknown, extra: unknown) => ({ changes, extra })),
}));

vi.mock('../notifications/service', () => ({
  notificationsService: { notify: vi.fn(async () => undefined) },
}));

vi.mock('../../infrastructure/realtime/socket-realtime.server', () => ({
  realtimeServer: { publish: vi.fn() },
}));

vi.mock('./assignment.service', () => ({
  AgentAssignmentService: class {
    offerAssignment = vi.fn(async () => {
      throw new Error('no candidates');
    });
  },
}));

import { TransactionModel } from '../../database/models';
import { AgentsService } from './service';
import { OpenJobsService } from './open-jobs.service';
import { AgentsRepository } from './repository';

describe('agents exit safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closeAgency responde 409 ACTIVE_JOBS si hay intermediación activa', async () => {
    const repo = {
      findUserById: vi.fn(async () => ({
        _id: new Types.ObjectId(),
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: { status: AgentOnboardingStatus.ACTIVE },
      })),
      closeAgency: vi.fn(),
    };

    vi.mocked(TransactionModel.countDocuments).mockReturnValue({
      exec: async () => 2,
    } as never);
    vi.mocked(TransactionModel.find).mockReturnValue({
      select: () => ({
        sort: () => ({
          limit: () => ({
            lean: () => ({
              exec: async () => [
                {
                  _id: new Types.ObjectId(),
                  code: 'CONF-JOB1',
                  title: 'Activa',
                  status: TransactionStatus.FUNDED,
                },
              ],
            }),
          }),
        }),
      }),
    } as never);

    const service = new AgentsService(repo as unknown as AgentsRepository);
    try {
      await service.closeAgency('agent-1');
      expect.fail('expected AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({ statusCode: 409, code: 'ACTIVE_JOBS' });
    }
    expect(repo.closeAgency).not.toHaveBeenCalled();
  });

  it('suspend no consulta ni muta participants de operaciones', async () => {
    const userId = new Types.ObjectId().toString();
    const repo = {
      findUserById: vi.fn(async () => ({
        _id: userId,
        fullName: 'Agente',
        email: 'a@test.local',
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: {
          status: AgentOnboardingStatus.ACTIVE,
          termsAccepted: true,
          ratesAccepted: true,
          currency: 'USD',
          draftStep: 5,
        },
        schedule: { timezone: 'America/Montevideo', weeklySlots: [], unspecifiedSchedule: true },
      })),
      setAgentActivity: vi.fn(async () => ({
        _id: userId,
        fullName: 'Agente',
        email: 'a@test.local',
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: {
          status: AgentOnboardingStatus.INACTIVE,
          termsAccepted: true,
          ratesAccepted: true,
          currency: 'USD',
          draftStep: 5,
        },
        schedule: { timezone: 'America/Montevideo', weeklySlots: [], unspecifiedSchedule: true },
      })),
    };

    vi.mocked(TransactionModel.countDocuments).mockReturnValue({
      exec: async () => 1,
    } as never);
    vi.mocked(TransactionModel.find).mockReturnValue({
      select: () => ({
        sort: () => ({
          limit: () => ({
            lean: () => ({
              exec: async () => [
                {
                  _id: new Types.ObjectId(),
                  code: 'CONF-ABC123',
                  title: 'Op',
                  status: TransactionStatus.FUNDED,
                },
              ],
            }),
          }),
        }),
      }),
    } as never);

    const service = new AgentsService(repo as unknown as AgentsRepository);
    const dto = await service.suspend(userId);
    expect(dto.status).toBe(AgentOnboardingStatus.INACTIVE);
    expect(repo.setAgentActivity).toHaveBeenCalledWith(userId, AgentOnboardingStatus.INACTIVE);
    expect(TransactionModel.findOne).not.toHaveBeenCalled();
  });

  it('withdrawFromJob marca intermediario REMOVED y deja escrow/status intactos', async () => {
    const agentId = new Types.ObjectId().toString();
    const buyerId = new Types.ObjectId();
    const intermediary = {
      user: new Types.ObjectId(agentId),
      role: ParticipantRole.INTERMEDIARY,
      status: ParticipantStatus.ACCEPTED,
      invitedAt: new Date(),
      respondedAt: new Date(),
    };
    const tx = {
      _id: new Types.ObjectId(),
      code: 'CONF-EXIT01',
      title: 'Salida',
      status: TransactionStatus.FUNDED,
      createdBy: buyerId,
      participants: [intermediary],
      statusHistory: [] as Array<{ note?: string; status: TransactionStatus }>,
      meetingLocation: undefined,
      save: vi.fn(async () => tx),
    };

    vi.mocked(TransactionModel.findOne).mockReturnValue({
      exec: async () => tx,
    } as never);

    const openJobs = new OpenJobsService();
    const result = await openJobs.withdrawFromJob(agentId, 'CONF-EXIT01');

    expect(result.lookingForAgent).toBe(true);
    expect(intermediary.status).toBe(ParticipantStatus.REMOVED);
    expect(tx.status).toBe(TransactionStatus.FUNDED);
    expect(tx.statusHistory.some((h) => (h.note ?? '').includes('Agente solicitó salida'))).toBe(
      true,
    );
    expect(tx.save).toHaveBeenCalled();
  });

  it('closeAgency con cero jobs activos llama repository.closeAgency', async () => {
    const userId = new Types.ObjectId().toString();
    const repo = {
      findUserById: vi.fn(async () => ({
        _id: userId,
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: { status: AgentOnboardingStatus.INACTIVE },
      })),
      closeAgency: vi.fn(async () => ({
        _id: userId,
        fullName: 'Agente',
        email: 'a@test.local',
        role: PlatformRole.USER,
        roles: [PlatformRole.USER],
        agent: {
          status: AgentOnboardingStatus.NONE,
          termsAccepted: false,
          ratesAccepted: false,
          currency: 'USD',
          draftStep: 1,
        },
        schedule: { timezone: 'America/Montevideo', weeklySlots: [] },
      })),
    };

    vi.mocked(TransactionModel.countDocuments).mockReturnValue({
      exec: async () => 0,
    } as never);
    vi.mocked(TransactionModel.find).mockReturnValue({
      select: () => ({
        sort: () => ({
          limit: () => ({
            lean: () => ({
              exec: async () => [],
            }),
          }),
        }),
      }),
    } as never);

    const service = new AgentsService(repo as unknown as AgentsRepository);
    const dto = await service.closeAgency(userId);
    expect(repo.closeAgency).toHaveBeenCalledWith(userId);
    expect(dto.status).toBe(AgentOnboardingStatus.NONE);
  });

  it('withdrawFromJob falla si no es intermediario ACCEPTED', async () => {
    vi.mocked(TransactionModel.findOne).mockReturnValue({
      exec: async () => ({
        _id: new Types.ObjectId(),
        code: 'CONF-EXIT02',
        status: TransactionStatus.FUNDED,
        participants: [],
        statusHistory: [],
        save: vi.fn(),
      }),
    } as never);

    const openJobs = new OpenJobsService();
    await expect(openJobs.withdrawFromJob(new Types.ObjectId().toString(), 'CONF-EXIT02')).rejects.toBeInstanceOf(
      Error,
    );
  });
});
