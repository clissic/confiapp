import { DayOfWeek } from '@confiapp/database';

/** Versión vigente de términos de agente. */
export const AGENT_TERMS_VERSION = '1.0.0';

export const AGENT_TERMS_TEXT = `
Términos y condiciones del Agente Intermediario — ConfiApp

1. Actuás como intermediario imparcial entre comprador y vendedor.
2. Protegés la confidencialidad de las partes y la evidencia de la operación.
3. Declarás disponibilidad real según los horarios configurados.
4. Tu tarifa se comunica con transparencia antes de aceptar una asignación.
5. ConfiApp puede suspender el rol ante incumplimiento o disputas graves.
6. Aceptás que los fondos de escrow no son de tu propiedad.
`.trim();

export const DAYS = Object.values(DayOfWeek);
