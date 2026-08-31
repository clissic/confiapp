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

export const scheduleStepSchema = z
  .object({
    timezone: z.string().min(2).max(64),
    unspecifiedSchedule: z.boolean().default(false),
    weeklySlots: z.array(scheduleSlotSchema).max(70),
  })
  .superRefine((value, ctx) => {
    if (!value.unspecifiedSchedule && value.weeklySlots.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Agregá al menos una franja horaria',
        path: ['weeklySlots'],
      });
    }
  });

export const areaStepSchema = z
  .object({
    workAreaLabel: z.string().trim().min(2, 'Indicá el centro en el mapa').max(200),
    workAreaCity: z.string().trim().min(2, 'Ciudad requerida').max(120),
    workAreaCountry: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'País ISO de 2 letras'),
    workAreaLat: z.number().nullable(),
    workAreaLng: z.number().nullable(),
    coverageRadiusKm: z.coerce.number().min(1, 'Mínimo 1 km').max(500, 'Máximo 500 km'),
  })
  .superRefine((value, ctx) => {
    if (value.workAreaLat == null || value.workAreaLng == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hacé click en el mapa para centrar la cobertura',
        path: ['workAreaLat'],
      });
    }
  });

export const rateStepSchema = z.object({
  ratesAccepted: z.boolean().refine((value) => value === true, {
    message: 'Debés aceptar el esquema de tarifas para continuar',
  }),
});

export type TermsStepValues = z.infer<typeof termsStepSchema>;
export type ScheduleStepValues = z.infer<typeof scheduleStepSchema>;
export type AreaStepValues = z.infer<typeof areaStepSchema>;
export type RateStepValues = z.infer<typeof rateStepSchema>;
