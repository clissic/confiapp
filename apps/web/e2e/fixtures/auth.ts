import { test as base, expect } from '@playwright/test';

/** Fixture e2e: limpia tokens (activar con `demoSession` en el test; no auto). */
export const test = base.extend<{ demoSession: void }>({
  demoSession: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    });
    await use();
  },
});

export { expect };
