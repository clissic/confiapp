import { describe, expect, it } from 'vitest';

import { diffBuyerProposalVsSellerConfirm } from './buyer-proposal-diff';

describe('diffBuyerProposalVsSellerConfirm', () => {
  const baseBuyer = {
    title: 'iPhone 13',
    description: 'Buen estado',
    amountCents: 50_000,
    currency: 'UYU',
    condition: undefined as string | undefined,
    category: undefined as string | undefined,
    feePayer: 'BUYER' as const,
  };

  it('sin diferencias de campos comparables → vacío (aunque haya fotos)', () => {
    const changes = diffBuyerProposalVsSellerConfirm(baseBuyer, {
      title: 'iPhone 13',
      description: 'Buen estado',
      amountCents: 50_000,
      currency: 'UYU',
      condition: '',
      category: '',
      feePayer: 'BUYER',
    });
    expect(changes).toEqual([]);
  });

  it('las fotos no marcan variación', () => {
    const changes = diffBuyerProposalVsSellerConfirm(baseBuyer, {
      title: 'iPhone 13',
      description: 'Buen estado',
      amountCents: 50_000,
      currency: 'UYU',
      condition: '',
      category: '',
      feePayer: 'BUYER',
    });
    expect(changes.find((c) => c.field === 'images')).toBeUndefined();
  });

  it('detecta cambios de título, precio y condición solo si el comprador definió condición/categoría', () => {
    const changes = diffBuyerProposalVsSellerConfirm(
      { ...baseBuyer, condition: 'FAIR', category: 'OTHER' },
      {
        title: 'iPhone 14',
        description: 'Buen estado',
        amountCents: 60_000,
        currency: 'UYU',
        condition: 'GOOD',
        category: 'ELECTRONICS',
        feePayer: 'BUYER',
      },
    );
    expect(changes.map((c) => c.field)).toEqual(['title', 'price', 'condition', 'category']);
    expect(changes.find((c) => c.field === 'price')).toMatchObject({
      from: '500.00 UYU',
      to: '600.00 UYU',
    });
  });

  it('no marca condición/categoría si el comprador no las envió', () => {
    const changes = diffBuyerProposalVsSellerConfirm(baseBuyer, {
      title: 'iPhone 13',
      description: 'Buen estado',
      amountCents: 50_000,
      currency: 'UYU',
      condition: 'GOOD',
      category: 'ELECTRONICS',
      feePayer: 'BUYER',
    });
    expect(changes).toEqual([]);
  });

  it('detecta cambio de quién paga la comisión', () => {
    const changes = diffBuyerProposalVsSellerConfirm(baseBuyer, {
      title: 'iPhone 13',
      description: 'Buen estado',
      amountCents: 50_000,
      currency: 'UYU',
      condition: '',
      category: '',
      feePayer: 'SPLIT_50_50',
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      field: 'feePayer',
      from: 'La paga el comprador',
      to: '50 % comprador / 50 % vendedor',
    });
  });
});
