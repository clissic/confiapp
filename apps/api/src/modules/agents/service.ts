import {
  AgentOnboardingStatus,
  PlatformRole,
  UserStatus,
  type IUser,
} from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';

import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error';

import { AGENT_TERMS_TEXT, AGENT_TERMS_VERSION } from './constants';
import type { AgentOnboardingDto, SaveAgentOnboardingDto } from './dto';
import { AgentsRepository, type UserDocument } from './repository';
import type { SubmitAgentOnboardingBody } from './validation';

function buildSummary(user: HydratedDocument<IUser> | UserDocument): string {
  const slots = user.schedule?.weeklySlots?.length ?? 0;
  const rate = user.agent?.hourlyRateCents;
  const radius = user.agent?.coverageRadiusKm ?? user.location?.coverageRadiusKm;
  const area = user.agent?.workAreaLabel ?? user.location?.label ?? 'Sin área';
  const rateLabel =
    rate != null ? `${(rate / 100).toFixed(2)} ${user.agent?.currency ?? 'UYU'}/h` : 'Tarifa pendiente';
  return `${area} · ${radius ?? '?'} km · ${slots} franjas · ${rateLabel}`;
}

function toDto(user: HydratedDocument<IUser> | UserDocument): AgentOnboardingDto {
  const agent = user.agent ?? {
    status: AgentOnboardingStatus.NONE,
    termsAccepted: false,
    currency: 'UYU',
    draftStep: 1,
  };

  return {
    status: agent.status,
    termsVersion: AGENT_TERMS_VERSION,
    termsText: AGENT_TERMS_TEXT,
    termsAccepted: Boolean(agent.termsAccepted),
    termsAcceptedAt: agent.termsAcceptedAt?.toISOString?.(),
    timezone: user.schedule?.timezone ?? 'America/Montevideo',
    weeklySlots: (user.schedule?.weeklySlots ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    workAreaLabel: agent.workAreaLabel ?? user.location?.label,
    workAreaCity: agent.workAreaCity ?? user.location?.address?.city,
    workAreaCountry: agent.workAreaCountry ?? user.location?.address?.country,
    coverageRadiusKm: agent.coverageRadiusKm ?? user.location?.coverageRadiusKm,
    hourlyRateCents: agent.hourlyRateCents,
    currency: agent.currency ?? 'UYU',
    draftStep: agent.draftStep ?? 1,
    isAgent:
      user.role === PlatformRole.AGENT ||
      user.roles?.includes(PlatformRole.AGENT) ||
      agent.status === AgentOnboardingStatus.ACTIVE,
    submittedAt: agent.submittedAt?.toISOString?.(),
    activatedAt: agent.activatedAt?.toISOString?.(),
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
    return toDto(user);
  }

  async saveDraft(userId: string, input: SaveAgentOnboardingDto): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');

    if (existing.agent?.status === AgentOnboardingStatus.ACTIVE) {
      throw new ForbiddenError('Ya sos agente activo. Editá disponibilidad desde tu perfil.');
    }

    const user = await this.repository.saveOnboardingDraft(userId, input);
    if (!user) throw new NotFoundError('User not found');
    return toDto(user);
  }

  async submit(userId: string, input: SubmitAgentOnboardingBody): Promise<AgentOnboardingDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundError('User not found');

    if (existing.agent?.status === AgentOnboardingStatus.ACTIVE) {
      throw new AppError(409, 'Already an active agent', undefined, 'ALREADY_AGENT');
    }

    if (existing.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('La cuenta debe estar activa para convertirse en agente');
    }

    const user = await this.repository.activateAgent(userId, {
      termsAccepted: true,
      timezone: input.timezone,
      weeklySlots: input.weeklySlots,
      workAreaLabel: input.workAreaLabel,
      workAreaCity: input.workAreaCity,
      workAreaCountry: input.workAreaCountry,
      coverageRadiusKm: input.coverageRadiusKm,
      hourlyRateCents: input.hourlyRateCents,
      currency: input.currency ?? 'UYU',
    });

    if (!user) throw new NotFoundError('User not found');

    const { auditService, AuditAction, AuditOutcome } = await import('../audit');
    auditService.track({
      actor: userId,
      action: AuditAction.ROLE_CHANGED,
      entityType: 'User',
      entityId: userId,
      outcome: AuditOutcome.SUCCESS,
      metadata: {
        role: PlatformRole.AGENT,
        agentStatus: AgentOnboardingStatus.ACTIVE,
        workAreaLabel: input.workAreaLabel,
        coverageRadiusKm: input.coverageRadiusKm,
      },
    });

    return toDto(user);
  }
}
