import path from 'node:path';
import { defineConfig } from 'vitest/config';

const JWT = 'test-jwt-secret-key-32chars-min!!';
const JWT_REFRESH = 'test-refresh-secret-key-32chars!!';

export default defineConfig({
  test: {
    name: 'api-unit',
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/**'],
    testTimeout: 60_000,
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
      PAYMENTS_AGENT_FEE_BPS: '500',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/modules/reviews/scoring.ts',
        'src/modules/payments/split.ts',
        'src/modules/transactions/state-machine.ts',
        'src/modules/agents/search-scoring.ts',
        'src/modules/audit/service.ts',
        'src/utils/crypto-tokens.ts',
        'src/utils/password.ts',
        'src/infrastructure/security/jwt.ts',
        'src/shared/errors/app-error.ts',
        'src/middleware/require-roles.ts',
        'src/middleware/validate.ts',
        'src/middleware/async-handler.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
    alias: {
      '@confiapp/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
    },
  },
});
