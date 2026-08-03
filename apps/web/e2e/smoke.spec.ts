import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('carga el shell de la app', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/ConfiApp/i).first()).toBeVisible();
  });

  test('navega a operaciones', async ({ page }) => {
    await page.goto('/operaciones');
    await expect(page.locator('body')).toBeVisible();
  });

  test('navega a reputación', async ({ page }) => {
    await page.goto('/reputacion');
    await expect(page.getByText(/Reputación|Confianza|Calificaciones/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('navega a auditoría', async ({ page }) => {
    await page.goto('/auditoria');
    await expect(page.getByText(/Auditoría|Forense/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
