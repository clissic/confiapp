import { LegalPlaceholder } from './LegalPlaceholder';

/** Política de Privacidad — placeholder en desarrollo. */
export function PrivacyPage() {
  return (
    <LegalPlaceholder
      kicker="Legal"
      title="Política de Privacidad"
      lead="Cómo recopilamos, usamos y protegemos tus datos personales en ConfiApp."
      upcomingTopics={[
        'Qué datos recopilamos y con qué finalidad',
        'Base legal y conservación de la información',
        'Compartición con terceros y procesadores de pago',
        'Tus derechos de acceso, rectificación y eliminación',
        'Cookies, seguridad y contacto del responsable',
      ]}
    />
  );
}
