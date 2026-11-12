import { describe, expect, it } from 'vitest';

import {
  documentMatches,
  maskDocumentNumber,
  normalizeDocumentNumber,
  snapshotFromUserInfo,
} from './id-digital-userinfo';

describe('id-digital userinfo helpers', () => {
  it('snapshot extrae documento, nivel y métodos', () => {
    const snap = snapshotFromUserInfo({
      sub: 's',
      document: { document_number: ' 12345678 ', document_type: 'CI', document_country: 'UY' },
      registration_level: '2',
      registration_level_description: 'Presencial',
      validation_methods: [{ name: 'x', last_validation_date: 'no-es-fecha' }],
    });
    expect(snap.document).toEqual({ number: '12345678', type: 'CI', country: 'UY' });
    expect(snap.registrationLevel).toBe(2);
    expect(snap.validationMethods).toEqual([{ name: 'x', lastValidationDate: undefined }]);
  });

  it('snapshot sin documento', () => {
    expect(snapshotFromUserInfo({ sub: 's' }).document).toBeUndefined();
  });

  it('normaliza y compara CI', () => {
    expect(normalizeDocumentNumber('1.234.567-8')).toBe('12345678');
    const ci = { number: '12345678', type: 'CI', country: 'UY' };
    expect(documentMatches('1.234.567-8', ci)).toBe(true);
    expect(documentMatches('1234567', ci)).toBe(true); // sin dígito verificador
    expect(documentMatches('1234568', ci)).toBe(false);
    expect(documentMatches('', ci)).toBe(false);
    expect(documentMatches('AB123', { number: 'ab-123', type: 'PASSPORT', country: 'AR' })).toBe(
      true,
    );
  });

  it('enmascara', () => {
    expect(maskDocumentNumber('1.234.567-8')).toBe('*****678');
    expect(maskDocumentNumber(undefined)).toBeUndefined();
  });
});
