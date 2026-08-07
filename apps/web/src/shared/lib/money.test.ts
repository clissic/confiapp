import { describe, expect, it, beforeEach } from 'vitest';

import { fromKm, toKm, formatDistance, KM_PER_MI } from './distance';
import { convertCents } from './fx';
import { formatDateTime, formatMoney, formatOperationMoney } from './money';
import { setPreferencesSnapshot } from '../preferences/snapshot';

describe('shared/lib/distance', () => {
  it('convierte km ↔ mi de ida y vuelta', () => {
    const km = 16.09344;
    const mi = fromKm(km, 'MI');
    expect(mi).toBeCloseTo(10, 5);
    expect(toKm(mi, 'MI')).toBeCloseTo(km, 5);
  });

  it('formatea distancia en km y mi', () => {
    expect(formatDistance(10, 'KM', 0)).toBe('10 km');
    expect(formatDistance(KM_PER_MI, 'MI', 0)).toBe('1 mi');
    expect(formatDistance(null)).toBe('—');
  });
});

describe('shared/lib/fx', () => {
  it('convierte centavos entre monedas con rates USD-base', () => {
    const rates = { USD: 1, UYU: 40, BRL: 5 };
    expect(convertCents(100, 'USD', 'UYU', rates)).toBe(4000);
    expect(convertCents(4000, 'UYU', 'USD', rates)).toBe(100);
  });

  it('no convierte si faltan rates', () => {
    expect(convertCents(1000, 'USD', 'UYU', null)).toBe(1000);
  });
});

describe('shared/lib/money', () => {
  beforeEach(() => {
    setPreferencesSnapshot({
      currency: 'USD',
      timezone: 'America/Montevideo',
      rates: null,
    });
  });

  it('formatea UYU con ISO + $ pegado (sin convertir)', () => {
    expect(formatMoney(5_000_000, 'UYU', { convert: false })).toBe('UYU $50.000,00');
  });

  it('formatea USD con ISO + $ pegado (sin convertir)', () => {
    expect(formatMoney(12345, 'USD', { convert: false })).toBe('USD $123,45');
  });

  it('formatea BRL con ISO + $ pegado (sin convertir)', () => {
    expect(formatMoney(150_000, 'BRL', { convert: false })).toBe('BRL $1.500,00');
  });

  it('formatOperationMoney no aplica preferencia de cuenta', () => {
    setPreferencesSnapshot({
      currency: 'USD',
      rates: { USD: 1, UYU: 40, BRL: 5 },
    });
    expect(formatOperationMoney(4000, 'UYU')).toBe('UYU $40,00');
    expect(formatOperationMoney(100, 'USD')).toBe('USD $1,00');
  });

  it('convierte a moneda preferida cuando hay rates (wallet)', () => {
    setPreferencesSnapshot({
      currency: 'USD',
      rates: { USD: 1, UYU: 40, BRL: 5 },
    });
    expect(formatMoney(4000, 'UYU')).toBe('USD $1,00');
  });

  it('sin rates no miente: mantiene moneda fuente', () => {
    setPreferencesSnapshot({
      currency: 'USD',
      rates: null,
    });
    expect(formatMoney(4000, 'UYU')).toBe('UYU $40,00');
  });

  it('fallback si currency inválida', () => {
    expect(formatMoney(10000, 'NOTREAL', { convert: false })).toBe('NOTREAL $100,00');
  });

  it('devuelve guión si no hay cents', () => {
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });

  it('formatea fechas inválidas sin romper', () => {
    expect(formatDateTime('not-a-date')).toBeTruthy();
  });
});
