import { describe, expect, it } from 'vitest';

import { computeEscrowSplit } from '../../src/modules/payments/split';
import { mercadoPagoMockPreference, stubMercadoPagoClient } from '../mocks/mercadopago.client';

describe('integration/payments.split+mock', () => {
  it('split de ejemplo Uruguay coincide con fees default', () => {
    const split = computeEscrowSplit(5_000_000, 2000, 500);
    expect(split.sellerCents / split.grossCents).toBeCloseTo(0.75, 5);
  });

  it('mock de MP responde preference', async () => {
    const client = stubMercadoPagoClient();
    expect(client.isMock()).toBe(true);
    const pref = await client.createPreference();
    expect(pref.id).toBe(mercadoPagoMockPreference.id);
  });
});
