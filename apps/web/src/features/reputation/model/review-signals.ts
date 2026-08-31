/** Labels humanos de señales de ponderación de reseñas (uso admin / docs). */
export const REVIEW_SIGNAL_LABELS: Record<string, { label: string; tip: string }> = {
  NEW_ACCOUNT: {
    label: 'Cuenta nueva',
    tip: 'Quien calificó tiene menos de 2 operaciones completadas. La reseña pesa menos (×0,65).',
  },
  LOW_AMOUNT: {
    label: 'Monto bajo',
    tip: 'La operación fue de monto muy bajo. La reseña pesa menos (×0,75).',
  },
  RECIPROCAL_SUSPICIOUS: {
    label: 'Recíproca',
    tip: 'Hubo calificaciones mutuas iguales en poco tiempo. La reseña pesa mucho menos (×0,35).',
  },
  RAPID_FIRE: {
    label: 'Ráfaga',
    tip: 'Quien calificó dejó 3 o más reseñas en 10 minutos. La reseña pesa menos (×0,40).',
  },
  MANUAL_HOLD: {
    label: 'Retenida',
    tip: 'Reseña retenida para moderación. No suma al promedio de reputación (peso 0).',
  },
};

export function reviewSignalMeta(flag: string) {
  return (
    REVIEW_SIGNAL_LABELS[flag] ?? {
      label: flag,
      tip: 'Señal interna de ponderación de la reseña.',
    }
  );
}

export function activeReviewSignals(flags: string[] | undefined): string[] {
  return (flags ?? []).filter((f) => f && f !== 'NONE');
}
