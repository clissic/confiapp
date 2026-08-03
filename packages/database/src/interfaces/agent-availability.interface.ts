import type { Types } from 'mongoose';

import type { DayOfWeek } from '../types/enums';

/** Franja horaria semanal (HH:mm en timezone del agente). */
export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AvailabilityException {
  date: Date;
  isAvailable: boolean;
  note?: string;
}

/**
 * Disponibilidad de un agente intermediario (1:1 con User role AGENT).
 */
export interface IAgentAvailability {
  user: Types.ObjectId;
  timezone: string;
  isAcceptingAssignments: boolean;
  maxActiveTransactions: number;
  weeklySlots: AvailabilitySlot[];
  exceptions: AvailabilityException[];
  /** Etiqueta de zona de cobertura (ciudad / radio aproximado). */
  coverageLabel?: string;
  coverageRadiusKm?: number;
  hourlyRateCents?: number;
  currency?: string;
  termsAcceptedAt?: Date;
  termsVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
