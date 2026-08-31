export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type AgentOnboardingStatus = 'NONE' | 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type AgentActiveJobStatus =
  | 'WAITING_PARTICIPANT'
  | 'ACCEPTED'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'DISPUTED';

export interface AgentScheduleSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AgentActiveJob {
  id: string;
  code: string;
  title: string;
  status: AgentActiveJobStatus;
}

export interface AgentAgencyStats {
  completedDeliveries: number;
  successRate: number;
  ratingAverage: number;
  ratingCount: number;
  ratingDistribution: {
    one: number;
    two: number;
    three: number;
    four: number;
    five: number;
  };
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
  workAreaLat?: number;
  workAreaLng?: number;
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
  activeJobsCount?: number;
  activeJobs?: AgentActiveJob[];
  stats?: AgentAgencyStats;
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
  workAreaLat?: number;
  workAreaLng?: number;
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
  workAreaLat: number;
  workAreaLng: number;
  coverageRadiusKm: number;
  currency?: string;
}
