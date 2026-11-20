import {
  test,
  expect,
  installDemoSession,
  isApiRequest,
  E2E_USER,
  E2E_ADMIN,
} from './fixtures/session';

test.describe('wallet y admin retiros', () => {
  test('usuario ve retiro pendiente sin poder auto-completar', async ({ page }) => {
    await installDemoSession(page, E2E_USER);

    await page.route('**/wallet**', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      const url = route.request().url();
      if (url.includes('/complete')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: '{"message":"forbidden"}',
        });
        return;
      }
      if (url.includes('/withdrawals')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'w-e2e-1',
                amountCents: 64_000,
                currency: 'UYU',
                status: 'PENDING',
                destinationHint: 'BROU · ****1234',
                requestedAt: new Date().toISOString(),
              },
            ],
          }),
        });
        return;
      }
      if (url.includes('/movements') || url.includes('/commissions') || url.includes('/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
        });
        return;
      }
      // GET /wallet summary
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ACTIVE',
          currency: 'UYU',
          saldoCents: 96_000,
          pendienteCents: 32_000,
          retenidoCents: 0,
          lifetimeEarnedCents: 160_000,
          lifetimeSpentCents: 0,
          movementsCount: 1,
          pendingWithdrawalsCount: 1,
          commissionsTotalCents: 0,
          salesWithdrawableCents: 96_000,
        }),
      });
    });

    await page.goto('/wallet', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/ingresar/);
    await expect(page.getByText(/Cargando sesión/i)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText(/Pendiente de transferencia/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /^Completar$/i })).toHaveCount(0);
    await expect(
      page.getByText(/ConfiApp transferirá a tu método de cobro/i).first(),
    ).toBeVisible();
  });

  test('admin finanzas: cola de retiros y marcar transferido', async ({ page }) => {
    await installDemoSession(page, E2E_ADMIN);

    let completed = false;

    await page.route('**/wallet/admin/withdrawals', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: completed
            ? []
            : [
                {
                  id: 'w-admin-1',
                  userId: 'e2e-user-1',
                  userEmail: 'e2e@confiapp.test',
                  userName: 'E2E User',
                  amountCents: 25_000,
                  currency: 'UYU',
                  status: 'PENDING',
                  destinationHint: 'Prex · 1065233',
                  requestedAt: new Date().toISOString(),
                },
              ],
        }),
      });
    });

    await page.route('**/wallet/withdrawals/w-admin-1/complete', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      completed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          withdrawal: { id: 'w-admin-1', status: 'COMPLETED' },
        }),
      });
    });

    await page.route('**/finance/payout-batches**', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 }),
      });
    });

    await page.goto('/admin/finanzas', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Cargando sesión/i)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText(/Retiros de wallet/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/E2E User|e2e@confiapp.test/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Marcar transferido/i }).click();
    await expect(page.getByText(/No hay retiros pendientes/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('términos de no reembolso', () => {
  test('TyC incluyen cancelación sin disputa', async ({ page }) => {
    await page.goto('/terminos#termino-16');
    await expect(page.getByRole('heading', { name: /Pagos y contratación del Agente/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Cancelación sin disputa y no reembolso de la contratación del Agente/i),
    ).toBeVisible();
    await expect(
      page.getByText(/deberá abrir una disputa/i).first(),
    ).toBeVisible();
  });
});
