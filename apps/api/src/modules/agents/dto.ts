import type { AgentOnboardingStatus, DayOfWeek } from '@confiapp/database';

export interface AgentScheduleSlotDto {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AgentOnboardingDto {
  status: AgentOnboardingStatus;
  termsVersion: string;
  termsText: string;
  termsAccepted: boolean;
  termsAcceptedAt?: string;
  timezone: string;
  weeklySlots: AgentScheduleSlotDto[];
  unspecifiedSchedule: boolean;
  workAreaLabel?: string;
  workAreaCity?: string;
  workAreaCountry?: string;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency: string;
  ratesAccepted: boolean;
  ratesAcceptedAt?: string;
  draftStep: number;
  isAgent: boolean;
  submittedAt?: string;
  activatedAt?: string;
  preview: {
    fullName: string;
    email: string;
    summary: string;
  };
}

export interface SaveAgentOnboardingDto {
  termsAccepted?: boolean;
  timezone?: string;
  weeklySlots?: AgentScheduleSlotDto[];
  unspecifiedSchedule?: boolean;
  workAreaLabel?: string;
  workAreaCity?: string;
  workAreaCountry?: string;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency?: string;
  ratesAccepted?: boolean;
  draftStep?: number;
}
