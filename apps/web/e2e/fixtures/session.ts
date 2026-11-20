import type { Page, Route } from '@playwright/test';

import { test as base, expect } from './auth';

export const E2E_USER = {
  id: 'e2e-user-1',
  email: 'e2e@confiapp.test',
  fullName: 'E2E User',
  status: 'ACTIVE',
  role: 'USER',
  emailVerified: true,
  identityVerified: true,
} as const;

export const E2E_ADMIN = {
  ...E2E_USER,
  id: 'e2e-admin-1',
  email: 'e2e.admin@confiapp.test',
  fullName: 'E2E Admin',
  role: 'ADMIN',
} as const;

type SessionUser = typeof E2E_USER | typeof E2E_ADMIN;

export const DEMO_TX_KEY = 'confiapp.transactions.demo';

/**
 * Distingue navegación HTML de llamadas API.
 * Axios a veces no aparece como `xhr`/`fetch` en Playwright → no filtrar solo por eso.
 */
export function isApiRequest(route: Route): boolean {
  const type = route.request().resourceType();
  if (
    type === 'document' ||
    type === 'stylesheet' ||
    type === 'script' ||
    type === 'image' ||
    type === 'font' ||
    type === 'media' ||
    type === 'manifest'
  ) {
    return false;
  }
  const accept = route.request().headers()['accept'] ?? '';
  if (accept.includes('text/html')) return false;
  return true;
}

async function mockAuthApis(page: Page, user: SessionUser): Promise<void> {
  await page.route('**/auth/me', async (route) => {
    if (!isApiRequest(route)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  await page.route('**/auth/refresh', async (route) => {
    if (!isApiRequest(route)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user,
        tokens: {
          accessToken: 'e2e-demo-access',
          refreshToken: 'e2e-demo-refresh',
          tokenType: 'Bearer',
          expiresIn: '1h',
        },
      }),
    });
  });

  await page.route('**/notifications**', async (route) => {
    if (!isApiRequest(route)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], unreadCount: 0 }),
    });
  });

  await page.route('**/users/me', async (route) => {
    if (!isApiRequest(route)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: '',
        phoneVerified: false,
        role: user.role,
        roles: [user.role],
        status: user.status,
        emailVerified: user.emailVerified,
        identityVerified: user.identityVerified,
        payoutMethods: [],
        preferences: {
          currency: 'UYU',
          notifications: { email: true, push: true, sms: false },
        },
      }),
    });
  });
}

/**
 * Sesión local para E2E sin API real.
 * 1) registra mocks de auth
 * 2) abre origen público
 * 3) escribe tokens + user en localStorage
 * 4) el test navega a la ruta protegida (React lee la sesión)
 */
export async function installDemoSession(
  page: Page,
  user: SessionUser = E2E_USER,
): Promise<void> {
  await mockAuthApis(page, user);

  await page.goto('/terminos', { waitUntil: 'domcontentloaded' });
  await page.evaluate((sessionUser) => {
    localStorage.setItem('accessToken', 'e2e-demo-access');
    localStorage.setItem('refreshToken', 'e2e-demo-refresh');
    localStorage.setItem('authUser', JSON.stringify(sessionUser));
  }, user);
}

/** Siembra operaciones en localStorage (fallback demo de transactions.api). */
export async function seedDemoTransactions(
  page: Page,
  transactions: unknown[],
): Promise<void> {
  await page.evaluate(
    ({ key, list }) => {
      localStorage.setItem(key, JSON.stringify(list));
    },
    { key: DEMO_TX_KEY, list: transactions },
  );
}

export const test = base.extend<{
  demoUserSession: void;
  demoAdminSession: void;
}>({
  demoUserSession: [
    async ({ page }, use) => {
      await installDemoSession(page, E2E_USER);
      await use();
    },
    { auto: false },
  ],
  demoAdminSession: [
    async ({ page }, use) => {
      await installDemoSession(page, E2E_ADMIN);
      await use();
    },
    { auto: false },
  ],
});

export { expect };
