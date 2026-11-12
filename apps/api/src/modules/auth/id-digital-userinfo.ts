import type { UserIdDigitalDocument, UserIdDigitalValidationMethod } from '@confiapp/database';

import type { IdDigitalUserInfo } from '../../infrastructure/id-digital/id-digital.client';

/** Datos del userinfo que se persisten en `User.idDigital`. */
export interface IdDigitalUserInfoSnapshot {
  document?: UserIdDigitalDocument;
  registrationLevel?: number;
  registrationLevelDescription?: string;
  validationMethods?: UserIdDigitalValidationMethod[];
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Extrae lo útil del userinfo (sin teléfono, fecha de nacimiento ni nombres). */
export function snapshotFromUserInfo(info: IdDigitalUserInfo): IdDigitalUserInfoSnapshot {
  const doc = info.document;
  const document: UserIdDigitalDocument | undefined =
    doc && typeof doc === 'object'
      ? {
          number: str(doc.document_number, 32),
          type: str(doc.document_type, 32),
          country: str(doc.document_country, 8),
        }
      : undefined;

  const levelRaw = info.registration_level;
  const level =
    typeof levelRaw === 'number'
      ? levelRaw
      : typeof levelRaw === 'string' && levelRaw.trim() !== ''
        ? Number(levelRaw)
        : undefined;

  const validationMethods = Array.isArray(info.validation_methods)
    ? info.validation_methods
        .filter((m) => m && typeof m === 'object')
        .slice(0, 20)
        .map((m) => ({
          name: str(m.name, 64),
          lastValidationDate: parseDate(m.last_validation_date),
        }))
    : undefined;

  return {
    document:
      document && (document.number || document.type || document.country) ? document : undefined,
    registrationLevel:
      level !== undefined && Number.isFinite(level) ? Math.trunc(level) : undefined,
    registrationLevelDescription: str(info.registration_level_description, 200),
    validationMethods,
  };
}

function isUruguayanCi(doc: UserIdDigitalDocument): boolean {
  const type = (doc.type ?? '').toUpperCase();
  const country = (doc.country ?? '').toUpperCase();
  return type === 'CI' || type === 'CEDULA' || country === 'UY' || country === 'URY';
}

/** Normaliza para comparar: mayúsculas, solo alfanuméricos (sin puntos ni guiones). */
export function normalizeDocumentNumber(value: string | undefined | null): string {
  return (value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Compara el documento cargado por el usuario con el de ID Digital.
 * Para CI uruguaya acepta que el usuario haya omitido el dígito verificador.
 */
export function documentMatches(
  userDocumentNumber: string | undefined | null,
  idDigitalDocument: UserIdDigitalDocument,
): boolean {
  const mine = normalizeDocumentNumber(userDocumentNumber);
  const theirs = normalizeDocumentNumber(idDigitalDocument.number);
  if (!mine || !theirs) return false;
  if (mine === theirs) return true;
  if (isUruguayanCi(idDigitalDocument)) {
    const mineDigits = mine.replace(/\D/g, '');
    const theirDigits = theirs.replace(/\D/g, '');
    if (mineDigits === theirDigits) return true;
    if (theirDigits.length >= 7 && mineDigits === theirDigits.slice(0, -1)) return true;
  }
  return false;
}

/** Enmascara un documento para logs/auditoría: solo los últimos 3 caracteres. */
export function maskDocumentNumber(value: string | undefined | null): string | undefined {
  const normalized = normalizeDocumentNumber(value);
  if (!normalized) return undefined;
  return `${'*'.repeat(Math.max(normalized.length - 3, 0))}${normalized.slice(-3)}`;
}
