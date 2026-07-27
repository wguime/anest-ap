/**
 * E2E: mudança de 2026-07-26 — Cirurgias Particulares e Codificação Anestésica
 * saíram do Menu e passaram a viver em Gestão → Faturamento; Codificação
 * Anestésica saiu da incubação DEV-only e foi para produção.
 *
 * Rodar contra o BUILD DE PRODUÇÃO (`npm run build && npm run preview`,
 * E2E_BASE_URL=http://localhost:4173) — só assim `import.meta.env.DEV` é false
 * e o teste prova que o card de Codificação aparece em produção.
 *
 * Pre-req: E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar: npx playwright test e2e/faturamento-hub.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';
const SHOT_DIR = process.env.E2E_SHOT_DIR || 'test-results';

test.use({ viewport: { width: 375, height: 812 } });

test('Faturamento é o hub dos 2 módulos de cobrança e o Menu não os lista mais', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });
  // DeferredProviders montam ~2s após o login e remontam a subárvore
  await page.waitForTimeout(3000);

  // ── MENU: nenhum dos dois cards permanece
  await page.goto('/menu-page');
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Cirurgias Particulares')).toHaveCount(0);
  await expect(page.getByText('Codificação Anestésica')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/faturamento-hub-menu.png`, fullPage: true });

  // ── GESTÃO → FATURAMENTO: os dois cards, inclusive no build de produção
  await page.goto('/faturamento');
  await expect(page.getByRole('heading', { name: 'Faturamento' })).toBeVisible({ timeout: 15_000 });
  const cirurgias = page.getByText('Cirurgias Particulares').first();
  const codificacao = page.getByText('Codificação Anestésica').first();
  await expect(cirurgias).toBeVisible();
  await expect(codificacao).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/faturamento-hub.png`, fullPage: true });

  // ── navegação: cada card abre a sua página
  await codificacao.click();
  await expect(page.getByRole('heading', { name: 'Codificação Anestésica' })).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe('/codificacao-anestesica');

  await page.goto('/faturamento');
  await page.getByText('Cirurgias Particulares').first().click();
  await expect(page.getByRole('heading', { name: /Cirurgias Particulares/i })).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe('/cirurgias-particulares');
});
