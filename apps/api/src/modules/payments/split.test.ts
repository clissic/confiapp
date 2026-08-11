import { describe, expect, it } from 'vitest';

import { centsToMajorUnit, computeEscrowSplit, IntermediationFeeError } from './split';

describe('payments/split', () => {
  it('USD $1500 → comisión $25; comprador asume → paga 1525, vendedor 1500', () => {
    const split = computeEscrowSplit({
      productCents: 150_000,
      currency: 'USD',
      feePayer: 'BUYER',
      uyuPerUsd: 40,
    });
    expect(split.commissionUsd).toBe(25);
    expect(split.commissionCents).toBe(2_500);
    expect(split.buyerPaysCents).toBe(152_500);
    expect(split.sellerNetCents).toBe(150_000);
    expect(split.platformFeeCents).toBe(500); // 20%
    expect(split.agentFeeCents).toBe(2_000); // 80%
  });

  it('vendedor asume la comisión → comprador paga precio, vendedor recibe precio − comisión', () => {
    const split = computeEscrowSplit({
      productCents: 150_000,
      currency: 'USD',
      feePayer: 'SELLER',
      uyuPerUsd: 40,
    });
    expect(split.buyerPaysCents).toBe(150_000);
    expect(split.sellerNetCents).toBe(147_500);
  });

  it('50/50 reparte la comisión', () => {
    const split = computeEscrowSplit({
      productCents: 150_000,
      currency: 'USD',
      feePayer: 'SPLIT_50_50',
      uyuPerUsd: 40,
    });
    expect(split.buyerPaysCents).toBe(151_250);
    expect(split.sellerNetCents).toBe(148_750);
  });

  it('UYU convierte a USD con rate 40 para elegir franja', () => {
    // UYU $40.000 = USD $1000 → franja $20
    const split = computeEscrowSplit({
      productCents: 4_000_000,
      currency: 'UYU',
      feePayer: 'BUYER',
      uyuPerUsd: 40,
    });
    expect(split.commissionUsd).toBe(20);
    expect(split.commissionCents).toBe(80_000); // 20 * 40 * 100
    expect(split.buyerPaysCents).toBe(4_080_000);
  });

  it('falla si el vendedor no cubre la comisión', () => {
    expect(() =>
      computeEscrowSplit({
        productCents: 500,
        currency: 'USD',
        feePayer: 'SELLER',
        uyuPerUsd: 40,
      }),
    ).toThrow(IntermediationFeeError);
  });

  it('convierte centavos a unidad mayor', () => {
    expect(centsToMajorUnit(5050)).toBe(50.5);
    expect(centsToMajorUnit(100)).toBe(1);
  });
});
