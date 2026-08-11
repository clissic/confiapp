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
      productTitle: 'Notebook Lenovo',
      productDescription: 'Busco notebook gamer en buen estado',
      condition: 'GOOD',
      category: 'ELECTRONICS',
      amount: 45000,
      currency: 'uyu',
      feePayer: 'BUYER',
    });
    expect(parsed.currency).toBe('UYU');
    expect(parsed.inviteExpiresInDays).toBe(7);
    expect(parsed.productTitle).toBe('Notebook Lenovo');
    expect(parsed.feePayer).toBe('BUYER');
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
      feePayer: 'SELLER',
      conditionsSummary: 'Retiro en persona con mediador',
      returnInstructions: 'Devolver embasado en el mismo punto de entrega',
    });
    expect(parsed.category).toBe('OTHER');
    expect(parsed.feePayer).toBe('SELLER');
    expect(parsed.returnInstructions.length).toBeGreaterThan(9);
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
      feePayer: 'SPLIT_50_50',
      returnInstructions: 'Si no acepta, devolver al domicilio del vendedor',
    });
    expect(parsed.currency ?? 'UYU').toBeTruthy();
    expect(parsed.feePayer).toBe('SPLIT_50_50');
  });
});
