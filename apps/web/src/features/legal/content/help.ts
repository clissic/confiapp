export type HelpSection = {
  id: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

/** Contenido del Centro de Ayuda (guías de producto, no legales). */
export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    lead: 'ConfiApp conecta comprador, vendedor y un Agente de confianza para operaciones con pago protegido.',
    bullets: [
      'Como comprador podés iniciar una operación o unirte a una oferta del vendedor.',
      'Como vendedor publicás el producto y las condiciones; el pago queda en resguardo hasta la entrega.',
      'Como Agente verificás el producto, lo trasladás y confirmás la entrega.',
    ],
  },
  {
    id: 'operaciones',
    title: 'Operaciones y pagos',
    paragraphs: [
      'Cada operación tiene estados claros: aceptación, pago protegido, en curso y completada. Los fondos se liberan al vendedor cuando comprador y Agente confirman la entrega (o tras el plazo automático de 72 h si corresponde).',
    ],
    bullets: [
      'El pago protegido evita transferencias directas entre particulares sin respaldo.',
      'Podés seguir el historial desde el detalle de la operación.',
      'Si algo sale mal, el comprador puede abrir un reclamo para revisión de ConfiApp.',
    ],
  },
  {
    id: 'reputacion',
    title: 'Reputación y calificaciones',
    lead: 'Tu score (0–100) resume cómo te fue en la plataforma. Las estrellas que ves en el perfil son el promedio de reseñas recibidas.',
    paragraphs: [
      'Al completar una operación, cada parte puede calificar a las otras con las que interactuó: comprador y vendedor se califican entre sí y al Agente; el Agente puede calificar a comprador y vendedor. Tenés 30 días desde el cierre para dejar la reseña.',
    ],
    subsections: [
      {
        title: 'Cómo se arma el score',
        bullets: [
          'Hasta 55 puntos por el promedio de calificaciones (suavizado para cuentas con pocas reseñas).',
          'Hasta 25 puntos por volumen de operaciones completadas.',
          'Hasta 15 puntos por tasa de éxito (completadas vs. canceladas o disputadas).',
          'Hasta 5 puntos si tenés la identidad verificada (KYC).',
        ],
      },
      {
        title: 'Por qué no todas las reseñas pesan igual',
        paragraphs: [
          'Para evitar que cuentas nuevas o patrones atípicos distorsionen la reputación, ConfiApp pondera cada reseña. El promedio que ves ya incorpora ese peso: una reseña de alguien con historial sólido cuenta más que una de una cuenta recién creada.',
          'Eso no significa que la reseña sea falsa: solo que el sistema la toma con más o menos cautela. Los detalles técnicos de ponderación (peso y señales) no se muestran en tu perfil; el equipo de ConfiApp puede revisarlos si hace falta moderar.',
        ],
        bullets: [
          'Cuentas con pocas operaciones completadas: la reseña pesa menos.',
          'Operaciones de monto muy bajo: la reseña pesa menos.',
          'Operaciones de monto alto: la reseña puede pesar un poco más.',
          'Patrones raros (por ejemplo muchas reseñas seguidas o calificaciones mutuas idénticas en minutos): se reduce el peso o se revisa la reseña.',
        ],
      },
    ],
  },
  {
    id: 'reclamos',
    title: 'Reclamos y disputas',
    paragraphs: [
      'Si no recibiste el producto o hay un problema grave, podés reportarlo desde la operación. El equipo de ConfiApp revisa el caso y puede reanudar, cancelar o reembolsar según corresponda.',
    ],
  },
  {
    id: 'soporte',
    title: 'Contacto',
    paragraphs: [
      'Para dudas urgentes sobre una operación en curso, usá el chat de esa operación o el canal de soporte indicado en notificaciones. Para temas de cuenta o verificación, revisá la sección de perfil y KYC.',
    ],
  },
];
