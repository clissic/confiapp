import { describe, expect, it } from 'vitest';

import {
  commissionForProductUyu,
  computeIntermediationFees,
} from '@confiapp/shared';

describe('fee tiers UYU boundaries (spec §4)', () => {
  const cases: Array<[number, number]> = [
    [7_999, 400],
    [8_000, 600],
    [23_999, 600],
    [24_000, 800],
    [47_999, 800],
    [48_000, 1_000],
    [79_999, 1_000],
    [80_000, 1_400],
  ];

  it.each(cases)('precio UYU $%s → comisión $%s', (price, fee) => {
    expect(commissionForProductUyu(price)).toBe(fee);
  });
});

describe('caso principal $30.000 UYU', () => {
  it('BUYER: comisión 800, agente 640, plataforma 160', () => {
    const split = computeIntermediationFees({
      productCents: 3_000_000,
      currency: 'UYU',
      feePayer: 'BUYER',
    });
    expect(split.commissionUyu).toBe(800);
    expect(split.commissionCents).toBe(80_000);
    expect(split.agentFeeCents).toBe(64_000);
    expect(split.platformFeeCents).toBe(16_000);
    expect(split.buyerPaysCents).toBe(3_080_000);
    expect(split.sellerNetCents).toBe(3_000_000);
  });
});
