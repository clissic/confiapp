import { describe, expect, it } from 'vitest';

import {
  confirmSaleSchema,
  createSellerTransactionSchema,
  createTransactionSchema,
} from './schemas';

describe('transactions/schemas', () => {
  it('acepta operación comprador válida', () => {
    const parsed = createTransactionSchema.parse({
      title: 'Notebook Gamer',
      conditionsSummary: 'Entrega con agente en Montevideo',
      amount: 45000,
      currency: 'uyu',
    });
    expect(parsed.currency).toBe('UYU');
    expect(parsed.inviteExpiresInDays).toBe(7);
  });

  it('rechaza monto inválido', () => {
    const result = createTransactionSchema.safeParse({
      title: 'Ab',
      conditionsSummary: 'corta',
      amount: -1,
    });
    expect(result.success).toBe(false);
  });

  it('acepta confirmación de venta', () => {
    const parsed = confirmSaleSchema.parse({
      title: 'iPhone 14',
      description: 'Equipo en muy buen estado general',
      condition: 'GOOD',
      price: 22000,
      currency: 'UYU',
    });
    expect(parsed.category).toBe('OTHER');
  });

  it('acepta operación vendedor', () => {
    const parsed = createSellerTransactionSchema.parse({
      title: 'Vendo monitor',
      conditionsSummary: 'Retiro en persona con mediador',
      productTitle: 'Monitor 27',
      productDescription: 'Monitor IPS 27 pulgadas 144Hz',
      condition: 'LIKE_NEW',
      price: 12000,
      currency: 'USD',
    });
    expect(parsed.currency ?? 'UYU').toBeTruthy();
  });
});
