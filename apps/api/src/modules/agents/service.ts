import {
  AgentOnboardingStatus,
  IdentityVerificationStatus,
  PlatformRole,
  UserStatus,
  type IUser,
} from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';

import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import {
  AuditAction,
  AuditOutcome,
  auditService,
  buildAuditUpdatePayload,
} from '../audit';

import {
  countActiveAgentJobs,
  listActiveAgentJobs,
} from './agent-jobs';
import {
  agentActivationSummary,
  agentDraftAuditNote,
  collectAgentDraftChanges,
} from './audit-diff';
import { AGENT_TERMS_TEXT, AGENT_TERMS_VERSION } from './constants';
import type { AgentOnboardingDto, SaveAgentOnboardingDto } from './dto';
import { AgentsRepository, type UserDocument } from './repository';
import type { SubmitAgentOnboardingBody } from './validation';

function buildSummary(user: HydratedDocument<IUser> | UserDocument): string {
  const slots = user.schedule?.weeklySlots?.length ?? 0;
  const radius = user.agent?.coverageRadiusKm ?? user.location?.coverageRadiusKm;
  const area = user.agent?.workAreaLabel ?? user.location?.label ?? 'Sin área';
  const rateLabel = user.agent?.ratesAccepted
    ? 'Tarifa de plataforma aceptada'
    : 'Tarifa pendiente';
  const franjaLabel = user.schedule?.unspecifiedSchedule
    ? 'Disponible 24 h'
    : slots === 1
      ? '1 franja'
      : `${slots} franjas`;
  return `${area} · ${radius ?? '?'} km · ${franjaLabel} · ${rateLabel}`;
}

async function toDto(
  user: HydratedDocument<IUser> | UserDocument,
): Promise<AgentOnboardingDto> {
  const agent = user.agent ?? {
    status: AgentOnboardingStatus.NONE,
    termsAccepted: false,
    ratesAccepted: false,
    currency: 'UYU',
    draftStep: 1,
  };

  const registered =
    agent.status === AgentOnboardingStatus.ACTIVE ||
    agent.status === AgentOnboardingStatus.INACTIVE;

  const userId = String(user._id);
  const activeJobsCount = registered ? await countActiveAgentJobs(userId) : 0;
  const activeJobs = registered ? await listActiveAgentJobs(userId, 10) : [];

  const agentRating = user.roleRatings?.agent;
  const distribution = agentRating?.distribution ?? {
    one: 0,
    two: 0,
    three: 0,
    four: 0,
    five: 0,
  };
  const completedDeliveries = user.stats?.asAgentCount ?? 0;
  const successRate =
    typeof user.stats?.successRate === 'number' ? user.stats.successRate : 0;

  return {
    status: agent.status,
    termsVersion: AGENT_TERMS_VERSION,
    termsText: AGENT_TERMS_TEXT,
    termsAccepted: Boolean(agent.termsAccepted),
    termsAcceptedAt: agent.termsAcceptedAt?.toISOString?.(),
    timezone:
      registered || (agent.draftStep ?? 1) >= 3
        ? (user.schedule?.timezone ?? 'America/Montevideo')
        : 'America/Montevideo',
    weeklySlots: (user.schedule?.weeklySlots ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    unspecifiedSchedule: user.schedule?.unspecifiedSchedule === true,
    workAreaLabel: agent.workAreaLabel ?? user.location?.label,
    workAreaCity: agent.workAreaCity ?? user.location?.address?.city,
    workAreaCountry: agent.workAreaCountry ?? user.location?.address?.country,
    workAreaLat: user.location?.point?.coordinates?.[1],
    workAreaLng: user.location?.point?.coordinates?.[0],
    coverageRadiusKm: agent.coverageRadiusKm ?? user.location?.coverageRadiusKm,
    hourlyRateCents: agent.hourlyRateCents,
    currency: agent.currency ?? 'UYU',
    ratesAccepted: Boolean(agent.ratesAccepted),
    ratesAcceptedAt: agent.ratesAcceptedAt?.toISOString?.(),
    draftStep: agent.draftStep ?? 1,
    isAgent: registered,
    submittedAt: agent.submittedAt?.toISOString?.(),
    activatedAt: agent.activatedAt?.toISOString?.(),
    activeJobsCount,
    activeJobs,
    stats: {
      completedDeliveries,
      successRate,
      ratingAverage: agentRating?.average ?? 0,
      ratingCount: agentRating?.count ?? 0,
      ratingDistribution: {
        one: distribution.one ?? 0,
        two: distribution.two ?? 0,
        three: distribution.three ?? 0,
        four: distribution.four ?? 0,
        five: distribution.five ?? 0,
      },
    },
    preview: {
      fullName: user.fullName,
      email: user.email,
      summary: buildSummary(user),
    },
  };
}

export class AgentsService {
  constructor(private readonly repository = new AgentsRepository()) {}

  async getOnboarding(userId: string): Promise<AgentOnboardingDto> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found');
    return await toDto(user);
  }

  async saveDraft(userId: string, input: SaveAgentOnboardingDto): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');

    if (existing.agent?.status === AgentOnboardingStatus.SUSPENDED) {
      throw new ForbiddenError('Tu agencia está suspendida. Contactá soporte.');
    }

    const status = existing.agent?.status;
    const isRegistered =
      status === AgentOnboardingStatus.ACTIVE || status === AgentOnboardingStatus.INACTIVE;
    const changes = collectAgentDraftChanges(existing, input);

    const user = await this.repository.saveOnboardingDraft(userId, input);
    if (!user) throw new NotFoundError('User not found');

    if (changes.length > 0) {
      auditService.track({
        actor: userId,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: userId,
        outcome: AuditOutcome.SUCCESS,
        metadata: buildAuditUpdatePayload(changes, {
          note: agentDraftAuditNote(input, isRegistered),
          draftStep: input.draftStep,
          agentStatus: status,
        }),
      });
    }

    return await toDto(user);
  }

  async submit(userId: string, input: SubmitAgentOnboardingBody): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');

    if (
      existing.agent?.status === AgentOnboardingStatus.ACTIVE ||
      existing.agent?.status === AgentOnboardingStatus.INACTIVE
    ) {
      throw new AppError(409, 'Already an active agent', undefined, 'ALREADY_AGENT');
    }

    if (existing.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('La cuenta debe estar activa para convertirse en agente');
    }

    const kycVerified =
      existing.kyc?.status === IdentityVerificationStatus.VERIFIED ||
      existing.verification?.identity?.status === IdentityVerificationStatus.VERIFIED;

    if (!kycVerified) {
      throw new ForbiddenError(
        'Debés verificar tu identidad (DNI o pasaporte) antes de convertirte en agente.',
      );
    }

    const user = await this.repository.activateAgent(userId, {
      termsAccepted: true,
      ratesAccepted: true,
      timezone: input.timezone,
      weeklySlots: input.unspecifiedSchedule ? [] : input.weeklySlots,
      unspecifiedSchedule: input.unspecifiedSchedule,
      workAreaLabel: input.workAreaLabel,
      workAreaCity: input.workAreaCity,
      workAreaCountry: input.workAreaCountry,
      workAreaLat: input.workAreaLat,
      workAreaLng: input.workAreaLng,
      coverageRadiusKm: input.coverageRadiusKm,
      currency: input.currency ?? 'UYU',
    });

    if (!user) throw new NotFoundError('User not found');

    const fromRole = existing.role;
    const fromRoles = existing.roles?.length ? existing.roles : [existing.role];
    const activationSummary = agentActivationSummary({
      timezone: input.timezone,
      unspecifiedSchedule: input.unspecifiedSchedule,
      weeklySlots: input.weeklySlots,
      workAreaLabel: input.workAreaLabel,
      workAreaCity: input.workAreaCity,
      coverageRadiusKm: input.coverageRadiusKm,
    });
    auditService.track({
      actor: userId,
      action: AuditAction.ROLE_CHANGED,
      entityType: 'User',
      entityId: userId,
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        from: fromRole,
        to: PlatformRole.AGENT,
        summary: `${fromRole} > ${PlatformRole.AGENT} · ${activationSummary}`,
        changes: [
          {
            field: 'role',
            from: fromRole,
            to: PlatformRole.AGENT,
          },
        ],
        rolesFrom: fromRoles,
        rolesTo: [...new Set([...fromRoles, PlatformRole.AGENT])],
        agentStatus: AgentOnboardingStatus.ACTIVE,
        workAreaLabel: input.workAreaLabel,
        coverageRadiusKm: input.coverageRadiusKm,
        note: 'Alta como agente intermediario',
      },
    });

    return await toDto(user);
  }

  async suspend(userId: string): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');
    if (existing.agent?.status !== AgentOnboardingStatus.ACTIVE) {
      throw new AppError(
        409,
        'Solo un agente ACTIVE puede suspender actividad',
        undefined,
        'INVALID_STATUS',
      );
    }
    const user = await this.repository.setAgentActivity(userId, AgentOnboardingStatus.INACTIVE);
    if (!user) throw new NotFoundError('User not found');

    auditService.track({
      actor: userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'User',
      entityId: userId,
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        from: AgentOnboardingStatus.ACTIVE,
        to: AgentOnboardingStatus.INACTIVE,
        summary: `${AgentOnboardingStatus.ACTIVE} > ${AgentOnboardingStatus.INACTIVE}`,
        changes: [
          {
            field: 'agent.status',
            from: AgentOnboardingStatus.ACTIVE,
            to: AgentOnboardingStatus.INACTIVE,
          },
        ],
        note: 'Suspensión de actividad de agente',
      },
    });

    return await toDto(user);
  }

  async resume(userId: string): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');
    if (existing.agent?.status !== AgentOnboardingStatus.INACTIVE) {
      throw new AppError(409, 'Solo un agente INACTIVE puede reactivar', undefined, 'INVALID_STATUS');
    }
    const user = await this.repository.setAgentActivity(userId, AgentOnboardingStatus.ACTIVE);
    if (!user) throw new NotFoundError('User not found');

    auditService.track({
      actor: userId,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'User',
      entityId: userId,
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        from: AgentOnboardingStatus.INACTIVE,
        to: AgentOnboardingStatus.ACTIVE,
        summary: `${AgentOnboardingStatus.INACTIVE} > ${AgentOnboardingStatus.ACTIVE}`,
        changes: [
          {
            field: 'agent.status',
            from: AgentOnboardingStatus.INACTIVE,
            to: AgentOnboardingStatus.ACTIVE,
          },
        ],
        note: 'Reactivación de actividad de agente',
      },
    });

    return await toDto(user);
  }

  async closeAgency(userId: string): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');
    const status = existing.agent?.status;
    if (status !== AgentOnboardingStatus.ACTIVE && status !== AgentOnboardingStatus.INACTIVE) {
      throw new AppError(409, 'No tenés una agencia abierta para cerrar', undefined, 'INVALID_STATUS');
    }

    const activeJobsCount = await countActiveAgentJobs(userId);
    if (activeJobsCount > 0) {
      const jobs = await listActiveAgentJobs(userId, 20);
      throw new AppError(
        409,
        `No podés cerrar la agencia: tenés ${activeJobsCount} operación${activeJobsCount === 1 ? '' : 'es'} activa${activeJobsCount === 1 ? '' : 's'}. Solicitá la salida de cada una o completá el trabajo.`,
        { count: activeJobsCount, jobs },
        'ACTIVE_JOBS',
      );
    }

    const fromRole = existing.role;
    const fromRoles = existing.roles?.length ? existing.roles : [existing.role];
    const user = await this.repository.closeAgency(userId);
    if (!user) throw new NotFoundError('User not found');

    const toRole = user.role;
    auditService.track({
      actor: userId,
      action: AuditAction.ROLE_CHANGED,
      entityType: 'User',
      entityId: userId,
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        from: fromRole,
        to: toRole,
        summary: `${fromRole} > ${toRole}`,
        changes: [
          {
            field: 'role',
            from: fromRole,
            to: toRole,
          },
          {
            field: 'agent.status',
            from: String(status),
            to: AgentOnboardingStatus.NONE,
          },
        ],
        rolesFrom: fromRoles,
        rolesTo: user.roles,
        note: 'Cierre de agencia',
      },
    });

    return await toDto(user);
  }
}
