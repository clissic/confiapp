import { LegalPlaceholder } from './LegalPlaceholder';

/** Centro de Ayuda — placeholder en desarrollo. */
export function HelpPage() {
  return (
    <LegalPlaceholder
      kicker="Soporte"
      title="Centro de Ayuda"
      lead="Guías, preguntas frecuentes y canales de contacto para resolver dudas sobre la plataforma."
      upcomingTopics={[
        'Primeros pasos: comprador, vendedor y agente',
        'Operaciones, pagos y estados de una transacción',
        'Verificación de identidad y cuenta Mercado Pago',
        'Reclamos, disputas y plazos de reporte',
        'Seguridad, buenas prácticas y contacto de soporte',
      ]}
    />
  );
}
