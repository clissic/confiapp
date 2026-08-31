import type {
  AgentOnboardingStatus,
  DayOfWeek,
  TransactionStatus,
} from '@confiapp/database';

export interface AgentScheduleSlotDto {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AgentActiveJobDto {
  id: string;
  code: string;
  title: string;
  status: TransactionStatus;
}

export interface AgentRatingDistributionDto {
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
}

export interface AgentAgencyStatsDto {
  /** Operaciones completadas como intermediario. */
  completedDeliveries: number;
  successRate: number;
  ratingAverage: number;
  ratingCount: number;
  ratingDistribution: AgentRatingDistributionDto;
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
  workAreaLat?: number;
  workAreaLng?: number;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency: string;
  ratesAccepted: boolean;
  ratesAcceptedAt?: string;
  draftStep: number;
  isAgent: boolean;
  submittedAt?: string;
  activatedAt?: string;
  /** Operaciones donde el agente sigue como intermediario ACCEPTED. */
  activeJobsCount: number;
  activeJobs: AgentActiveJobDto[];
  stats: AgentAgencyStatsDto;
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
  workAreaLat?: number;
  workAreaLng?: number;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency?: string;
  ratesAccepted?: boolean;
  draftStep?: number;
}
