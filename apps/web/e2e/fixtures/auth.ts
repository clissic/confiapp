import { test as base, expect } from '@playwright/test';

/** Fixture e2e: limpia storage para modo demo. */
export const test = base.extend<{ demoSession: void }>({
  demoSession: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
