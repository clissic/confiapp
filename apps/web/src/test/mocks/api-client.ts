/**
 * Mocks de API para tests de componentes web.
 */
export function mockApiClient() {
  return {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
  };
}
