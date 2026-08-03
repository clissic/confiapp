import { describe, expect, it } from 'vitest';

import { centsToMajorUnit, computeEscrowSplit } from './split';

describe('payments/split', () => {
  it('calcula 20% plataforma + 5% agente sobre UYU 50.000', () => {
    const split = computeEscrowSplit(5_000_000, 2000, 500);
    expect(split.grossCents).toBe(5_000_000);
    expect(split.platformFeeCents).toBe(1_000_000);
    expect(split.agentFeeCents).toBe(250_000);
    expect(split.sellerCents).toBe(3_750_000);
  });

  it('trunca negativos y decimales del bruto', () => {
    expect(computeEscrowSplit(-100, 2000, 500).grossCents).toBe(0);
    expect(computeEscrowSplit(100.9, 2000, 500).grossCents).toBe(100);
  });

  it('evita seller negativo si fees > 100%', () => {
    const split = computeEscrowSplit(1000, 6000, 6000);
    expect(split.sellerCents).toBe(0);
  });

  it('convierte centavos a unidad mayor', () => {
    expect(centsToMajorUnit(5050)).toBe(50.5);
    expect(centsToMajorUnit(100)).toBe(1);
  });
});
