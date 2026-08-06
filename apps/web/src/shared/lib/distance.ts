export type DistanceUnit = 'KM' | 'MI';

export const KM_PER_MI = 1.609344;

export function toKm(value: number, unit: DistanceUnit): number {
  if (!Number.isFinite(value)) return 0;
  return unit === 'MI' ? value * KM_PER_MI : value;
}

export function fromKm(km: number, unit: DistanceUnit): number {
  if (!Number.isFinite(km)) return 0;
  return unit === 'MI' ? km / KM_PER_MI : km;
}

export function formatDistance(
  km: number | undefined | null,
  unit: DistanceUnit = 'KM',
  digits = 1,
): string {
  if (km == null || Number.isNaN(km)) return '—';
  const value = fromKm(km, unit);
  const suffix = unit === 'MI' ? 'mi' : 'km';
  return `${value.toFixed(digits)} ${suffix}`;
}

export function distanceUnitLabel(unit: DistanceUnit): string {
  return unit === 'MI' ? 'mi' : 'km';
}
