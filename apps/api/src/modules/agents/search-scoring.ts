import {
  DayOfWeek,
  PlatformRole,
  AgentOnboardingStatus,
  UserStatus,
  type IUser,
  type UserScheduleSlot,
} from '@confiapp/database';

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

const WEEKDAY_SHORT: Record<string, DayOfWeek> = {
  Sun: DayOfWeek.SUNDAY,
  Mon: DayOfWeek.MONDAY,
  Tue: DayOfWeek.TUESDAY,
  Wed: DayOfWeek.WEDNESDAY,
  Thu: DayOfWeek.THURSDAY,
  Fri: DayOfWeek.FRIDAY,
  Sat: DayOfWeek.SATURDAY,
};

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Partes locales en el timezone del agente. */
export function getZonedDateParts(
  date: Date,
  timeZone: string,
): { dayOfWeek: DayOfWeek; minutes: number; ymd: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  const weekday = map.weekday ?? 'Mon';
  const dayOfWeek = WEEKDAY_SHORT[weekday] ?? JS_DAY_TO_ENUM[date.getUTCDay()]!;
  const hour = Number(map.hour ?? '0');
  const minute = Number(map.minute ?? '0');
  const ymd = `${map.year}-${map.month}-${map.day}`;

  return { dayOfWeek, minutes: hour * 60 + minute, ymd };
}

export function isWithinWeeklySlots(
  slots: UserScheduleSlot[] | undefined,
  dayOfWeek: DayOfWeek,
  minutes: number,
): boolean {
  if (!slots?.length) return false;
  return slots.some((slot) => {
    if (slot.dayOfWeek !== dayOfWeek) return false;
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    return minutes >= start && minutes < end;
  });
}

export function hasBlockingException(
  exceptions: Array<{ date: Date; isAvailable: boolean }> | undefined,
  ymd: string,
  timeZone: string,
): boolean {
  if (!exceptions?.length) return false;
  return exceptions.some((ex) => {
    const exYmd = getZonedDateParts(new Date(ex.date), timeZone).ymd;
    return exYmd === ymd && ex.isAvailable === false;
  });
}

/** Rating bayesiano suavizado hacia 4.0 con prior de 5 reviews. */
export function bayesianRating(average: number | undefined, count: number | undefined): number {
  const avg = average ?? 0;
  const n = count ?? 0;
  const priorAvg = 4;
  const priorN = 5;
  return (avg * n + priorAvg * priorN) / (n + priorN);
}

export function computeAgentScore(input: {
  distanceKm: number;
  radiusKm: number;
  ratingAverage?: number;
  ratingCount?: number;
  activeJobs: number;
  maxActive: number;
  coverageRadiusKm: number;
}): number {
  const scoreDistance = Math.max(0, 1 - input.distanceKm / Math.max(input.radiusKm, 0.001));
  const scoreRating = bayesianRating(input.ratingAverage, input.ratingCount) / 5;
  const scoreLoad = Math.max(
    0,
    1 - input.activeJobs / Math.max(input.maxActive, 1),
  );
  const coverage = Math.max(input.coverageRadiusKm, input.radiusKm, 0.001);
  const scoreCoverage = Math.max(0, 1 - input.distanceKm / coverage);

  return (
    0.35 * scoreDistance +
    0.3 * scoreRating +
    0.2 * scoreLoad +
    0.15 * scoreCoverage
  );
}

export function isActiveAgentUser(user: Pick<IUser, 'status' | 'roles' | 'role' | 'agent'>): boolean {
  if (user.status !== UserStatus.ACTIVE) return false;
  const roles = user.roles?.length ? user.roles : [user.role];
  if (!roles.includes(PlatformRole.AGENT)) return false;
  if (user.agent?.status && user.agent.status !== AgentOnboardingStatus.ACTIVE) {
    return false;
  }
  return true;
}
