/**
 * Env de test se inyecta vía vitest.config.ts `test.env`.
 * Aquí solo se aseguran defaults si se ejecuta fuera de Vitest.
 */
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.JWT_SECRET ??= 'test-jwt-secret-key-32chars-min!!';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-key-32chars!!';
process.env.DATABASE_URL ??= 'mongodb://127.0.0.1:27017/confiapp_test';
process.env.RATE_LIMIT_MAX ??= '10000';
process.env.AUTH_RATE_LIMIT_MAX ??= '10000';
process.env.MERCADOPAGO_ACCESS_TOKEN ??= '';
