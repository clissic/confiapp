import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm --filter @confiapp/web dev',
        url: WEB_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        cwd: ROOT,
      },
});
