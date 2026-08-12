import { z } from 'zod';
import { DayOfWeek } from '@confiapp/database';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleSlotSchema = z
  .object({
    dayOfWeek: z.nativeEnum(DayOfWeek),
    startTime: z.string().regex(TIME_RE, 'startTime must be HH:mm'),
    endTime: z.string().regex(TIME_RE, 'endTime must be HH:mm'),
  })
  .refine((slot) => slot.startTime < slot.endTime, {
    message: 'startTime must be before endTime',
  });

export const saveAgentOnboardingBodySchema = z
  .object({
    termsAccepted: z.boolean().optional(),
    timezone: z.string().trim().min(2).max(64).optional(),
    weeklySlots: z.array(scheduleSlotSchema).max(70).optional(),
    unspecifiedSchedule: z.boolean().optional(),
    workAreaLabel: z.string().trim().min(2).max(200).optional(),
    workAreaCity: z.string().trim().min(2).max(120).optional(),
    workAreaCountry: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'country must be ISO 3166-1 alpha-2')
      .optional(),
    coverageRadiusKm: z.number().min(1).max(500).optional(),
    hourlyRateCents: z.number().int().min(100).max(10_000_000).optional(),
    ratesAccepted: z.boolean().optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    draftStep: z.number().int().min(1).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const submitAgentOnboardingBodySchema = z
  .object({
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Debés aceptar los términos' }),
    }),
    ratesAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Debés aceptar el esquema de tarifas' }),
    }),
    timezone: z.string().trim().min(2).max(64),
    weeklySlots: z.array(scheduleSlotSchema).max(70),
    unspecifiedSchedule: z.boolean().default(false),
    workAreaLabel: z.string().trim().min(2).max(200),
    workAreaCity: z.string().trim().min(2).max(120),
    workAreaCountry: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'country must be ISO 3166-1 alpha-2'),
    coverageRadiusKm: z.number().min(1).max(500),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .default('UYU'),
  })
  .superRefine((value, ctx) => {
    if (!value.unspecifiedSchedule && value.weeklySlots.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Configurá al menos un horario',
        path: ['weeklySlots'],
      });
    }
  });

export type SaveAgentOnboardingBody = z.infer<typeof saveAgentOnboardingBodySchema>;
export type SubmitAgentOnboardingBody = z.infer<typeof submitAgentOnboardingBodySchema>;

export const agentSearchQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusKm: z.coerce.number().min(0.5).max(100).default(10),
  at: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const offerAssignmentBodySchema = z.object({
  transactionCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CONF-[A-Z0-9]{6,16}$/),
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radiusKm: z.coerce.number().min(0.5).max(100).default(10),
  at: z.string().optional(),
  expiresInSeconds: z.coerce.number().int().min(30).max(3600).default(120),
  excludeAgentIds: z.array(z.string().min(1)).max(50).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const transactionCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CONF-[A-Z0-9]{6,16}$/),
});

export const withdrawJobBodySchema = z
  .object({
    reason: z.string().trim().max(200).optional(),
  })
  .default({});

export const openJobsQuerySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    radiusKm: z.coerce.number().min(0.5).max(100).default(15),
    minCommissionUyu: z.coerce
      .number()
      .refine((v) => [400, 600, 800, 1000, 1400].includes(v), {
        message: 'minCommissionUyu must be one of 400, 600, 800, 1000, 1400',
      })
      .optional(),
    minBuyerRating: z.coerce.number().min(0).max(5).optional(),
    maxBuyerRating: z.coerce.number().min(0).max(5).optional(),
    minSellerRating: z.coerce.number().min(0).max(5).optional(),
    maxSellerRating: z.coerce.number().min(0).max(5).optional(),
    limit: z.coerce.number().int().min(1).max(80).default(40),
  })
  .superRefine((value, ctx) => {
    if (
      value.minBuyerRating != null &&
      value.maxBuyerRating != null &&
      value.minBuyerRating > value.maxBuyerRating
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minBuyerRating no puede ser mayor que maxBuyerRating',
        path: ['minBuyerRating'],
      });
    }
    if (
      value.minSellerRating != null &&
      value.maxSellerRating != null &&
      value.minSellerRating > value.maxSellerRating
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minSellerRating no puede ser mayor que maxSellerRating',
        path: ['minSellerRating'],
      });
    }
  });

export type AgentSearchQuery = z.infer<typeof agentSearchQuerySchema>;
export type OfferAssignmentBody = z.infer<typeof offerAssignmentBodySchema>;
export type OpenJobsQuery = z.infer<typeof openJobsQuerySchema>;
export type WithdrawJobBody = z.infer<typeof withdrawJobBodySchema>;

