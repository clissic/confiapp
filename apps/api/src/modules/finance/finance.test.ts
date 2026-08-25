import { describe, expect, it } from 'vitest';

import {
  addCommissionHoldDays,
  AGENT_COMMISSION_HOLD_DAYS,
  computeIntermediationFees,
  isWithinAgentPayoutWindow,
} from '@confiapp/shared';

import { ManualPayoutProvider } from '../../infrastructure/payments/payout-provider';

describe('finance MVP constants & fees', () => {
  it('hold de 21 días', () => {
    const from = new Date('2026-08-11T18:00:00.000Z');
    const available = addCommissionHoldDays(from);
    expect(AGENT_COMMISSION_HOLD_DAYS).toBe(21);
    expect(available.toISOString()).toBe('2026-09-01T18:00:00.000Z');
  });

  it('caso §30 BUYER $30.000', () => {
    const split = computeIntermediationFees({
      productCents: 3_000_000,
      currency: 'UYU',
      feePayer: 'BUYER',
    });
    expect(split.commissionCents).toBe(80_000);
    expect(split.agentFeeCents).toBe(64_000);
    expect(split.platformFeeCents).toBe(16_000);
  });

  it('ManualPayoutProvider no transfiere solo', async () => {
    const provider = new ManualPayoutProvider();
    const created = await provider.createPayout({
      agentId: 'a1',
      amountCents: 64_000,
      currency: 'UYU',
      commissionIds: ['c1'],
      batchId: 'b1',
    });
    expect(created.status).toBe('PENDING');
    const executed = await provider.executePayout(created.providerRef);
    expect(executed.status).toBe('PROCESSING');
  });

  it('ventana 1–10 es booleana determinista', () => {
    expect(typeof isWithinAgentPayoutWindow(new Date('2026-08-05T12:00:00'))).toBe(
      'boolean',
    );
  });
});
