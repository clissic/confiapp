import {
  test,
  expect,
  installDemoSession,
  seedDemoTransactions,
  isApiRequest,
  E2E_USER,
} from './fixtures/session';
import { FUNDED_AWAITING_BUYER_DECISION } from './fixtures/operations';

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
});
