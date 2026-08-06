import type { DayOfWeek, IUser } from '@confiapp/database';
import type { HydratedDocument } from 'mongoose';

import {
  formatAuditChangeSummary,
  pushAuditChange,
  type AuditFieldChange,
} from '../audit/diff';
import type { AgentScheduleSlotDto, SaveAgentOnboardingDto } from './dto';

const DAY_SHORT: Record<DayOfWeek, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

type UserLike = HydratedDocument<IUser> | { schedule?: IUser['schedule']; agent?: IUser['agent'] };

function formatSlots(slots: AgentScheduleSlotDto[] | undefined): string {
  if (!slots?.length) return 'sin franjas';
  return slots
    .map((slot) => {
      const day = DAY_SHORT[slot.dayOfWeek as DayOfWeek] ?? slot.dayOfWeek;
      return `${day} ${slot.startTime}–${slot.endTime}`;
    })
    .join(', ');
}

function scheduleLabel(user: UserLike): string {
  if (user.schedule?.unspecifiedSchedule) return '24 h';
  return formatSlots(
    (user.schedule?.weeklySlots ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
  );
}

export function collectAgentDraftChanges(
  before: UserLike,
  input: SaveAgentOnboardingDto,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  if (input.termsAccepted !== undefined) {
    pushAuditChange(changes, 'termsAccepted', before.agent?.termsAccepted === true, input.termsAccepted);
  }
  if (input.ratesAccepted !== undefined) {
    pushAuditChange(changes, 'ratesAccepted', before.agent?.ratesAccepted === true, input.ratesAccepted);
  }
  if (input.timezone !== undefined) {
    pushAuditChange(changes, 'timezone', before.schedule?.timezone, input.timezone);
  }

  const scheduleTouched =
    input.weeklySlots !== undefined || input.unspecifiedSchedule !== undefined;
  if (scheduleTouched) {
    if (input.unspecifiedSchedule !== undefined) {
      pushAuditChange(
        changes,
        'unspecifiedSchedule',
        before.schedule?.unspecifiedSchedule === true,
        input.unspecifiedSchedule,
      );
    }
    const nextUnspecified =
      input.unspecifiedSchedule !== undefined
        ? input.unspecifiedSchedule
        : before.schedule?.unspecifiedSchedule === true;
    const nextSlots = nextUnspecified
      ? []
      : (input.weeklySlots ??
        (before.schedule?.weeklySlots ?? []).map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })));
    pushAuditChange(changes, 'weeklySlots', scheduleLabel(before), nextUnspecified ? '24 h' : formatSlots(nextSlots));
  }
  if (input.workAreaLabel !== undefined) {
    pushAuditChange(changes, 'workAreaLabel', before.agent?.workAreaLabel, input.workAreaLabel);
  }
  if (input.workAreaCity !== undefined) {
    pushAuditChange(changes, 'workAreaCity', before.agent?.workAreaCity, input.workAreaCity);
  }
  if (input.workAreaCountry !== undefined) {
    pushAuditChange(changes, 'workAreaCountry', before.agent?.workAreaCountry, input.workAreaCountry);
  }
  if (input.coverageRadiusKm !== undefined) {
    pushAuditChange(
      changes,
      'coverageRadiusKm',
      before.agent?.coverageRadiusKm,
      input.coverageRadiusKm,
    );
  }
  if (input.currency !== undefined) {
    pushAuditChange(changes, 'currency', before.agent?.currency, input.currency);
  }

  return changes;
}

export function agentDraftAuditNote(
  input: SaveAgentOnboardingDto,
  isRegistered: boolean,
): string | undefined {
  if (!isRegistered) {
    if (input.termsAccepted === true) return 'Onboarding agente: términos';
    if (input.ratesAccepted === true) return 'Onboarding agente: tarifas';
    if (
      input.timezone !== undefined ||
      input.weeklySlots !== undefined ||
      input.unspecifiedSchedule !== undefined
    ) {
      return 'Onboarding agente: horarios';
    }
    if (
      input.workAreaLabel !== undefined ||
      input.workAreaCity !== undefined ||
      input.workAreaCountry !== undefined ||
      input.coverageRadiusKm !== undefined
    ) {
      return 'Onboarding agente: área';
    }
    return 'Onboarding agente: borrador';
  }

  if (
    input.timezone !== undefined ||
    input.weeklySlots !== undefined ||
    input.unspecifiedSchedule !== undefined
  ) {
    return 'Cambio de horarios de agente';
  }
  if (
    input.workAreaLabel !== undefined ||
    input.workAreaCity !== undefined ||
    input.workAreaCountry !== undefined ||
    input.coverageRadiusKm !== undefined
  ) {
    return 'Cambio de área de agente';
  }
  return 'Actualización de agencia';
}

export function agentActivationSummary(input: {
  timezone: string;
  unspecifiedSchedule: boolean;
  weeklySlots: AgentScheduleSlotDto[];
  workAreaLabel: string;
  workAreaCity: string;
  coverageRadiusKm: number;
}): string {
  const schedule = input.unspecifiedSchedule ? '24 h' : formatSlots(input.weeklySlots);
  return `Alta agente · ${input.workAreaLabel}, ${input.workAreaCity} · ${input.coverageRadiusKm} km · ${schedule}`;
}

export { formatAuditChangeSummary };
