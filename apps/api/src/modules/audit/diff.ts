/** Diff auditable: valores legibles para forense (sin secretos). */

export interface AuditFieldChange {
  field: string;
  from: string;
  to: string;
}

const EMPTY = '—';

/** Campos cuyo valor ya identifica el cambio (sin prefijo de etiqueta). */
const BARE_VALUE_FIELDS = new Set([
  'fullName',
  'displayName',
  'phone',
  'documentNumber',
  'role',
]);

const FIELD_LABELS: Record<string, string> = {
  fullName: 'nombre',
  displayName: 'nombre visible',
  documentNumber: 'documento',
  bio: 'bio',
  phone: 'celular',
  avatar: 'avatar',
  status: 'estado',
  address: 'dirección',
  locationLabel: 'ubicación',
  photos: 'fotos',
  payoutMethods: 'métodos de cobro',
  kyc: 'KYC',
  'kyc.status': 'KYC',
  role: 'rol',
  'agent.status': 'estado agencia',
  timezone: 'zona horaria',
  weeklySlots: 'horarios',
  unspecifiedSchedule: 'horario 24h',
  workAreaLabel: 'área',
  workAreaCity: 'ciudad',
  workAreaCountry: 'país',
  coverageRadiusKm: 'radio km',
  currency: 'moneda',
  termsAccepted: 'términos agente',
  ratesAccepted: 'tarifas agente',
  'preferences.language': 'idioma',
  'preferences.locale': 'locale',
  'preferences.timezone': 'zona horaria',
  'preferences.currency': 'moneda',
  'preferences.theme': 'tema',
  'preferences.distanceUnit': 'unidad distancia',
  'preferences.notifications.email': 'notif. email',
  'preferences.notifications.push': 'notif. push',
  'preferences.notifications.sms': 'notif. SMS',
  'preferences.notifications.inApp': 'notif. in-app',
  'preferences.notifications.marketing': 'notif. marketing',
  'preferences.notifications.transactionUpdates': 'notif. operaciones',
  'preferences.notifications.messageAlerts': 'notif. mensajes',
  'preferences.notifications.paymentAlerts': 'notif. pagos',
  'preferences.notifications.disputeAlerts': 'notif. disputas',
  'preferences.privacy.showLocation': 'privacidad ubicación',
  'preferences.privacy.showPhone': 'privacidad teléfono',
  'preferences.privacy.showEmail': 'privacidad email',
  'preferences.privacy.showRating': 'privacidad rating',
  'preferences.privacy.profileVisibility': 'visibilidad perfil',
};

export function auditValue(value: unknown): string {
  if (value == null) return EMPTY;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : EMPTY;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? EMPTY : `${value.length} ítem(s)`;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[objeto]';
    }
  }
  return String(value);
}

export function pushAuditChange(
  changes: AuditFieldChange[],
  field: string,
  from: unknown,
  to: unknown,
): void {
  const fromText = auditValue(from);
  const toText = auditValue(to);
  if (fromText === toText) return;
  changes.push({ field, from: fromText, to: toText });
}

export function labelAuditField(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Texto sutil: "antes > después" (con etiqueta cuando el valor no se autoexplica). */
export function formatAuditChangeSummary(changes: AuditFieldChange[]): string | undefined {
  if (changes.length === 0) return undefined;
  return changes
    .map((change) => {
      const diff = `${change.from} > ${change.to}`;
      if (BARE_VALUE_FIELDS.has(change.field)) return diff;
      return `${labelAuditField(change.field)}: ${diff}`;
    })
    .join(' · ');
}

export function formatAddressAudit(value: unknown): string {
  if (value == null || typeof value !== 'object') return EMPTY;
  const address = value as Record<string, unknown>;
  const parts = [
    address.formatted,
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.country,
    address.postalCode,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : EMPTY;
}

export function buildAuditUpdatePayload(changes: AuditFieldChange[], extra?: Record<string, unknown>) {
  const summary = formatAuditChangeSummary(changes);
  return {
    ...extra,
    fields: changes.map((change) => change.field),
    changes,
    ...(summary ? { summary } : {}),
  };
}
