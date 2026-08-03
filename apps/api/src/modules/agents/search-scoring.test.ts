import { describe, expect, it } from 'vitest';
import {
  AgentOnboardingStatus,
  DayOfWeek,
  PlatformRole,
  UserStatus,
} from '@confiapp/database';

import {
  bayesianRating,
  computeAgentScore,
  getZonedDateParts,
  hasBlockingException,
  isActiveAgentUser,
  isWithinWeeklySlots,
  timeToMinutes,
} from './search-scoring';

describe('agents/search-scoring', () => {
  it('convierte HH:mm a minutos', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('detecta franja semanal', () => {
    const slots = [
      { dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '18:00' },
    ];
    expect(isWithinWeeklySlots(slots, DayOfWeek.MONDAY, timeToMinutes('10:00'))).toBe(true);
    expect(isWithinWeeklySlots(slots, DayOfWeek.MONDAY, timeToMinutes('08:00'))).toBe(false);
    expect(isWithinWeeklySlots(undefined, DayOfWeek.MONDAY, 600)).toBe(false);
  });

  it('bloquea excepciones no disponibles', () => {
    const ymd = '2026-08-03';
    expect(
      hasBlockingException(
        [{ date: new Date('2026-08-03T12:00:00Z'), isAvailable: false }],
        ymd,
        'UTC',
      ),
    ).toBe(true);
    expect(hasBlockingException([], ymd, 'UTC')).toBe(false);
  });

  it('obtiene partes zonales', () => {
    const parts = getZonedDateParts(new Date('2026-08-03T15:00:00Z'), 'UTC');
    expect(parts.ymd).toBe('2026-08-03');
    expect(typeof parts.minutes).toBe('number');
  });

  it('score de agente combina distancia y rating', () => {
    const score = computeAgentScore({
      distanceKm: 2,
      radiusKm: 10,
      ratingAverage: 4.8,
      ratingCount: 20,
      activeJobs: 1,
      maxActive: 5,
      coverageRadiusKm: 15,
    });
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1);
    expect(bayesianRating(5, 0)).toBeCloseTo(4, 5);
  });

  it('valida agente activo', () => {
    expect(
      isActiveAgentUser({
        status: UserStatus.ACTIVE,
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: { status: AgentOnboardingStatus.ACTIVE } as never,
      }),
    ).toBe(true);

    expect(
      isActiveAgentUser({
        status: UserStatus.SUSPENDED,
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: { status: AgentOnboardingStatus.ACTIVE } as never,
      }),
    ).toBe(false);

    expect(
      isActiveAgentUser({
        status: UserStatus.ACTIVE,
        role: PlatformRole.USER,
        roles: [PlatformRole.USER],
        agent: { status: AgentOnboardingStatus.ACTIVE } as never,
      }),
    ).toBe(false);

    expect(
      isActiveAgentUser({
        status: UserStatus.ACTIVE,
        role: PlatformRole.AGENT,
        roles: [],
        agent: { status: AgentOnboardingStatus.DRAFT } as never,
      }),
    ).toBe(false);

    expect(
      isActiveAgentUser({
        status: UserStatus.ACTIVE,
        role: PlatformRole.AGENT,
        roles: [PlatformRole.AGENT],
        agent: undefined as never,
      }),
    ).toBe(true);
  });
});
