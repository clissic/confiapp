import { test, expect } from '@playwright/test';

/**
 * Flujo e2e de UI (demo mode sin token).
 * Con API + seed se puede extender a register/login real.
 */
test.describe('operaciones UI', () => {
  test('abre hub de nueva operación', async ({ page }) => {
    await page.goto('/operaciones/nueva');
    await expect(page.locator('body')).toContainText(/operaci|comprador|vendedor/i);
  });

  test('abre wallet', async ({ page }) => {
    await page.goto('/wallet');
    await expect(page.getByText(/Wallet|Billetera|saldo/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('abre pagos', async ({ page }) => {
    await page.goto('/pagos');
    await expect(page.locator('body')).toBeVisible();
  });
});
