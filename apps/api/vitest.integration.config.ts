import path from 'node:path';
import { defineConfig } from 'vitest/config';

const JWT = 'test-jwt-secret-key-32chars-min!!';
const JWT_REFRESH = 'test-refresh-secret-key-32chars!!';

/** Integration suite (Mongo Memory Server). Requiere descarga binaria la 1ª vez. */
export default defineConfig({
  test: {
    name: 'api-integration',
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'mongodb://127.0.0.1:27017/confiapp_test',
      JWT_SECRET: JWT,
      JWT_REFRESH_SECRET: JWT_REFRESH,
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      CORS_ORIGIN: 'http://localhost:3001',
      APP_URL: 'http://localhost:3001',
      API_PUBLIC_URL: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_MAX: '10000',
      AUTH_RATE_LIMIT_MAX: '10000',
      COOKIE_SECURE: 'false',
      MERCADOPAGO_ACCESS_TOKEN: '',
      PAYMENTS_DEFAULT_CURRENCY: 'UYU',
      PAYMENTS_PLATFORM_FEE_BPS: '2000',
      PAYMENTS_AGENT_FEE_BPS: '8000',
    },
    alias: {
      '@confiapp/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
    },
  },
});
