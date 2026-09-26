import { describe, expect, it } from 'vitest';

import {
  confirmSaleSchema,
  createSellerTransactionSchema,
  createTransactionSchema,
} from './schemas';

describe('transactions/schemas', () => {
  it('acepta operación comprador AGENT_FEE_ONLY sin precio', () => {
    const parsed = createTransactionSchema.parse({
      title: 'Notebook Gamer',
      conditionsSummary: 'Entrega con agente en Montevideo',
      productTitle: 'Notebook Lenovo',
      productDescription: 'Busco notebook gamer en buen estado',
      condition: 'GOOD',
      category: 'ELECTRONICS',
      fundingMode: 'AGENT_FEE_ONLY',
      currency: 'uyu',
    });
    expect(parsed.currency).toBe('UYU');
    expect(parsed.fundingMode).toBe('AGENT_FEE_ONLY');
    expect(parsed.inviteExpiresInDays).toBe(7);
    expect(parsed.productTitle).toBe('Notebook Lenovo');
  });

  it('exige precio y feePayer en ESCROW_FULL', () => {
    const result = createTransactionSchema.safeParse({
      title: 'Notebook Gamer',
      conditionsSummary: 'Entrega con agente en Montevideo',
      productTitle: 'Notebook Lenovo',
      productDescription: 'Busco notebook gamer en buen estado',
      condition: 'GOOD',
      category: 'ELECTRONICS',
      fundingMode: 'ESCROW_FULL',
      currency: 'UYU',
    });
    expect(result.success).toBe(false);
  });

  it('acepta ESCROW_FULL con monto', () => {
    const parsed = createTransactionSchema.parse({
      title: 'Notebook Gamer',
      conditionsSummary: 'Entrega con agente en Montevideo',
      productTitle: 'Notebook Lenovo',
      productDescription: 'Busco notebook gamer en buen estado',
      condition: 'GOOD',
      category: 'ELECTRONICS',
      fundingMode: 'ESCROW_FULL',
      amount: 45000,
      currency: 'uyu',
      feePayer: 'BUYER',
    });
    expect(parsed.feePayer).toBe('BUYER');
    expect(parsed.amount).toBe(45000);
  });

  it('rechaza monto inválido en título corto', () => {
    const result = createTransactionSchema.safeParse({
      title: 'Ab',
      conditionsSummary: 'corta',
      amount: -1,
    });
    expect(result.success).toBe(false);
  });

  it('acepta confirmación de venta AGENT_FEE_ONLY', () => {
    const parsed = confirmSaleSchema.parse({
      title: 'iPhone 14',
      description: 'Equipo en muy buen estado general',
      condition: 'GOOD',
      fundingMode: 'AGENT_FEE_ONLY',
      currency: 'UYU',
      conditionsSummary: 'Retiro en persona con mediador',
      returnInstructions: 'Devolver embasado en el mismo punto de entrega',
    });
    expect(parsed.category).toBe('OTHER');
    expect(parsed.returnInstructions.length).toBeGreaterThan(9);
  });

  it('acepta operación vendedor AGENT_FEE_ONLY', () => {
    const parsed = createSellerTransactionSchema.parse({
      title: 'Vendo monitor',
      conditionsSummary: 'Retiro en persona con mediador',
      productTitle: 'Monitor 27',
      productDescription: 'Monitor IPS 27 pulgadas 144Hz',
      condition: 'LIKE_NEW',
      fundingMode: 'AGENT_FEE_ONLY',
      currency: 'USD',
      returnInstructions: 'Si no acepta, devolver al domicilio del vendedor',
    });
    expect(parsed.fundingMode).toBe('AGENT_FEE_ONLY');
  });
});
