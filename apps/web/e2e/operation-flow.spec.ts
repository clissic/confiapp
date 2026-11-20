import {
  test,
  expect,
  installDemoSession,
  seedDemoTransactions,
  isApiRequest,
  E2E_USER,
} from './fixtures/session';
import {
  ACCEPTED_WAITING_AGENT,
  ACCEPTED_WITH_AGENT,
  FUNDED_AWAITING_BUYER_DECISION,
} from './fixtures/operations';

/**
 * Flujos críticos de operación (sesión demo + fallback localStorage).
 * No requieren API/Mongo: mockean auth y usan demo store de transacciones.
 */
test.describe('flujo operación crítico', () => {
  test('wizard comprador: llega a revisar con fee del Agente', async ({ page }) => {
    await installDemoSession(page, E2E_USER);

    await page.goto('/operaciones/nueva/comprador', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/ingresar/);
    await expect(page.getByText(/Cargando sesión/i)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByLabel('Título del producto')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Título del producto').fill('Auriculares E2E');
    await page.getByLabel('Descripción').fill('Nuevos, con caja');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByText(/Cómo se paga/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // AGENT_FEE_ONLY salta el paso precio → encuentro
    await expect(page.getByText(/Punto de encuentro/i).first()).toBeVisible();
    await page.locator('.ca-tx-delivery__modes').getByText('Coordinar por chat').click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByLabel('Título de la operación')).toBeVisible();
    await page.getByLabel('Título de la operación').fill('Compra auriculares E2E');
    await page.getByLabel('Instrucciones para el Agente').fill('Verificar sellado y funcionamiento');
    await page.getByLabel(/Ítem 1 del checklist/i).fill('Probar audio');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByText(/Revisar y crear/i).first()).toBeVisible();
    await expect(page.getByText(/Auriculares E2E|Compra auriculares E2E/i).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Generar enlace y crear/i }),
    ).toBeVisible();
  });

  test('rechazo de producto: avisa no reembolso y ofrece disputa', async ({ page }) => {
    await installDemoSession(page, E2E_USER);

    // Si la API responde, forzar fallback a demo list (sin tocar navegación).
    await page.route('**/transactions/by-code/**', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 404, body: 'not found' });
    });
    await page.route('**/transactions', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 500, body: 'fail' });
        return;
      }
      await route.continue();
    });

    await seedDemoTransactions(page, [FUNDED_AWAITING_BUYER_DECISION]);

    await page.goto(`/operaciones/${FUNDED_AWAITING_BUYER_DECISION.code}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).not.toHaveURL(/ingresar/);
    await expect(page.getByText(/Cargando sesión/i)).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.getByText(/verificación del Agente|verificación fue correcta/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Rechazar y cancelar/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/no se te reembolsa|no se reembolsa/i)).toBeVisible();
    await expect(dialog.getByText(/contratado/i)).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Términos y Condiciones/i })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /Abrir disputa/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /Entiendo: cancelar sin reembolso/i }),
    ).toBeVisible();
  });

  test('comprador cancela antes de que un Agente acepte', async ({ page }) => {
    await installDemoSession(page, E2E_USER);

    await page.route('**/transactions/by-code/**', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      const url = route.request().url();
      if (url.includes('/cancel-before-agent') && route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...ACCEPTED_WAITING_AGENT,
            status: 'CANCELLED',
            statusHistory: [
              ...ACCEPTED_WAITING_AGENT.statusHistory,
              {
                status: 'CANCELLED',
                changedAt: new Date().toISOString(),
                note: 'Comprador canceló antes de que un Agente aceptara la operación',
              },
            ],
          }),
        });
        return;
      }
      if (url.includes(ACCEPTED_WAITING_AGENT.code)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ACCEPTED_WAITING_AGENT),
        });
        return;
      }
      await route.fulfill({ status: 404, body: 'not found' });
    });

    await page.goto(`/operaciones/${ACCEPTED_WAITING_AGENT.code}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText(/Esperando Agente/i).first()).toBeVisible({
      timeout: 20_000,
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Cancelar operación/i }).click();
    await expect(page.getByText(/Cancelada|cancelada/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('muestra sección Agente de la operación tras aceptación', async ({ page }) => {
    await installDemoSession(page, E2E_USER);

    await page.route('**/transactions/by-code/**', async (route) => {
      if (!isApiRequest(route)) {
        await route.continue();
        return;
      }
      if (route.request().url().includes(ACCEPTED_WITH_AGENT.code)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ACCEPTED_WITH_AGENT),
        });
        return;
      }
      await route.fulfill({ status: 404, body: 'not found' });
    });

    await page.goto(`/operaciones/${ACCEPTED_WITH_AGENT.code}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: 'Agente de la operación' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Lucía').first()).toBeVisible();
    await expect(page.getByText('Pereira').first()).toBeVisible();
    await expect(page.getByText(/\+598 99 123 456/).first()).toBeVisible();
    await expect(page.getByText(/4\.8/).first()).toBeVisible();
  });
});
