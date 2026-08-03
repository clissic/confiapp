export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type AgentOnboardingStatus = 'NONE' | 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

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
  workAreaLabel?: string;
  workAreaCity?: string;
  workAreaCountry?: string;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency: string;
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
  workAreaLabel?: string;
  workAreaCity?: string;
  workAreaCountry?: string;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency?: string;
  draftStep?: number;
}

export interface AgentOnboardingSubmitPayload {
  termsAccepted: true;
  timezone: string;
  weeklySlots: AgentScheduleSlot[];
  workAreaLabel: string;
  workAreaCity: string;
  workAreaCountry: string;
  coverageRadiusKm: number;
  hourlyRateCents: number;
  currency: string;
}
