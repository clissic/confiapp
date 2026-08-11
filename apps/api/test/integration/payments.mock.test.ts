import { describe, expect, it } from 'vitest';

import { computeEscrowSplit } from '../../src/modules/payments/split';
import { mercadoPagoMockPreference, stubMercadoPagoClient } from '../mocks/mercadopago.client';

describe('integration/payments.split+mock', () => {
  it('comisión por franja: USD 1500 → $25 y split 20/80 sobre la comisión', () => {
    const split = computeEscrowSplit({
      productCents: 150_000,
      currency: 'USD',
      feePayer: 'BUYER',
      uyuPerUsd: 40,
    });
    expect(split.commissionUsd).toBe(25);
    expect(split.platformFeeCents + split.agentFeeCents).toBe(split.commissionCents);
    expect(split.platformFeeCents / split.commissionCents).toBeCloseTo(0.2, 5);
  });

  it('mock de MP responde preference', async () => {
    const client = stubMercadoPagoClient();
    expect(client.isMock()).toBe(true);
    const pref = await client.createPreference();
    expect(pref.id).toBe(mercadoPagoMockPreference.id);
  });
});
