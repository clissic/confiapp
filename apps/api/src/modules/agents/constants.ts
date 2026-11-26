import { DayOfWeek } from '@confiapp/database';

/** Versión vigente de términos de agente. */
export const AGENT_TERMS_VERSION = '1.2.0';

export const AGENT_TERMS_TEXT = `
Términos y condiciones del Agente Intermediario — ConfiApp

1. Actuás como intermediario imparcial entre comprador y vendedor.
2. Protegés la confidencialidad de las partes y la evidencia de la operación.
3. Declarás disponibilidad real según los horarios configurados.
4. La contratación del Agente es un monto fijo definido por ConfiApp (hoy UYU $490); el Agente no la fija. De ese monto, el 70% corresponde al Agente y el 30% a ConfiApp.
5. ConfiApp puede suspender el rol ante incumplimiento o disputas graves.
6. Aceptás que los montos gestionados por ConfiApp (fee del Agente) no son tuyos hasta que estén disponibles en tu wallet.
7. Salida de una operación aceptada: podés solicitar la salida (self-serve) mientras el trabajo esté asignado y aún no hayas iniciado la verificación del producto (ningún ítem del checklist marcado) ni la confirmación de entrega. En ese caso, la contratación del Agente permanece en ConfiApp y se busca un reemplazo.
8. Una vez iniciado el checklist de verificación, cerrada la verificación o iniciada la entrega, no podés solicitar salida por tu cuenta. Motivo: el producto puede estar bajo tu custodia y la evidencia de la operación ya está en curso; un reemplazo no puede continuar ese tramo. Si hay una emergencia o un hallazgo grave, debés contactar a soporte o abrir el canal de disputa/escalamiento previsto en la Plataforma; ConfiApp podrá reasignar o intervenir según el caso.
`.trim();

export const DAYS = Object.values(DayOfWeek);
