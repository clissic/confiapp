export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'ConfiApp API',
    version: '0.1.0',
    description: 'API de escrow físico — Express + MongoDB + Mongoose',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': { description: 'OK' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Registrar usuario',
        tags: ['Auth'],
        responses: { '201': { description: 'Registered' }, '409': { description: 'Email taken' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login (access JWT + refresh cookie/body)',
        tags: ['Auth'],
        responses: { '200': { description: 'Session' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotar refresh token',
        tags: ['Auth'],
        responses: { '200': { description: 'New session' }, '401': { description: 'Invalid refresh' } },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout (revoca refresh actual)',
        tags: ['Auth'],
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/auth/logout-all': {
      post: {
        summary: 'Logout de todos los dispositivos',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Logged out all' } },
      },
    },
    '/auth/change-password': {
      post: {
        summary: 'Cambiar contraseña',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Changed' } },
      },
    },
    '/auth/forgot-password': {
      post: {
        summary: 'Solicitar recuperación (anti-enumeración)',
        tags: ['Auth'],
        responses: { '200': { description: 'Generic message' } },
      },
    },
    '/auth/reset-password': {
      post: {
        summary: 'Restablecer contraseña con token',
        tags: ['Auth'],
        responses: { '200': { description: 'Reset' } },
      },
    },
    '/auth/verify-email': {
      post: {
        summary: 'Verificar email',
        tags: ['Auth'],
        responses: { '200': { description: 'Verified' } },
      },
    },
    '/auth/resend-verification': {
      post: {
        summary: 'Reenviar verificación',
        tags: ['Auth'],
        responses: { '200': { description: 'Generic message' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Usuario autenticado',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Current user' } },
      },
    },
    '/agents/onboarding': {
      get: {
        summary: 'Estado del onboarding de agente',
        tags: ['Agents'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Onboarding state' } },
      },
      put: {
        summary: 'Guardar borrador de onboarding',
        tags: ['Agents'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Draft saved' } },
      },
    },
    '/agents/onboarding/submit': {
      post: {
        summary: 'Confirmar alta como agente',
        tags: ['Agents'],
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Agent activated' } },
      },
    },
  },
};
