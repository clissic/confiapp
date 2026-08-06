export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type AgentOnboardingStatus = 'NONE' | 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AgentScheduleSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AgentOnboarding {
  status: AgentOnboardingStatus;
  termsVersion: string;
  termsText: string;
  termsAccepted: boolean;
  termsAcceptedAt?: string;
  timezone: string;
  weeklySlots: AgentScheduleSlot[];
  /** Disponible 24 h sin franjas horarias. */
  unspecifiedSchedule: boolean;
  workAreaLabel?: string;
  workAreaCity?: string;
  workAreaCountry?: string;
  coverageRadiusKm?: number;
  /** @deprecated La tarifa la define la app; se conserva por compatibilidad. */
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

export interface AgentOnboardingDraftPayload {
  termsAccepted?: boolean;
  timezone?: string;
  weeklySlots?: AgentScheduleSlot[];
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

export interface AgentOnboardingSubmitPayload {
  termsAccepted: true;
  ratesAccepted: true;
  timezone: string;
  weeklySlots: AgentScheduleSlot[];
  unspecifiedSchedule: boolean;
  workAreaLabel: string;
  workAreaCity: string;
  workAreaCountry: string;
  coverageRadiusKm: number;
  currency?: string;
}
