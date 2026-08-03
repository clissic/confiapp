import { z } from 'zod';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const termsStepSchema = z.object({
  termsAccepted: z.boolean().refine((value) => value === true, {
    message: 'Debés aceptar los términos para continuar',
  }),
});

export const scheduleSlotSchema = z
  .object({
    dayOfWeek: z.enum(DAYS),
    startTime: z.string().regex(TIME_RE, 'Formato HH:mm'),
    endTime: z.string().regex(TIME_RE, 'Formato HH:mm'),
  })
  .refine((slot) => slot.startTime < slot.endTime, {
    message: 'El inicio debe ser anterior al fin',
    path: ['endTime'],
  });

export const scheduleStepSchema = z.object({
  timezone: z.string().min(2).max(64),
  weeklySlots: z.array(scheduleSlotSchema).min(1, 'Agregá al menos una franja horaria'),
});

export const areaStepSchema = z.object({
  workAreaLabel: z.string().trim().min(2, 'Indicá el área').max(200),
  workAreaCity: z.string().trim().min(2, 'Ciudad requerida').max(120),
  workAreaCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'País ISO de 2 letras'),
  coverageRadiusKm: z.coerce.number().min(1, 'Mínimo 1 km').max(500, 'Máximo 500 km'),
});

export const rateStepSchema = z.object({
  hourlyRate: z.coerce
    .number()
    .min(1, 'Tarifa mínima 1')
    .max(100_000, 'Tarifa demasiado alta'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Moneda ISO 4217'),
});

export type TermsStepValues = z.infer<typeof termsStepSchema>;
export type ScheduleStepValues = z.infer<typeof scheduleStepSchema>;
export type AreaStepValues = z.infer<typeof areaStepSchema>;
export type RateStepValues = z.infer<typeof rateStepSchema>;
