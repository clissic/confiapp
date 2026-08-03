/**
 * Mock de Mercado Pago: modo MOCK cuando ACCESS_TOKEN está vacío.
 * Re-exporta helpers para stubs en tests de servicio.
 */
export const mercadoPagoMockPreference = {
  id: 'MOCK-PREF-001',
  initPoint: 'https://example.test/checkout',
  sandboxInitPoint: 'https://example.test/sandbox',
  provider: 'MOCK' as const,
};

export function stubMercadoPagoClient() {
  return {
    isMock: () => true,
    createPreference: async () => mercadoPagoMockPreference,
  };
}
