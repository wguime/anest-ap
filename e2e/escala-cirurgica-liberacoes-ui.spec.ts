/**
 * E2E: regras de UI da aba Liberações (pedidos do dono 2026-07-22) —
 *   - Reordenar (setas Subir/Descer) é EXCLUSIVO do plantonista: usuário clínico
 *     que NÃO é o 1º do rodapé não vê as setas.
 *   - Editor de linha (✏️): Local vira lista de locais do hospital (1 toque) +
 *     "Outro" que abre a digitação livre.
 *
 * Determinístico: clock fixo na data da escala DEMO client-side (26/06/2026);
 * o user E2E não é o plantonista da demo (LEONARDO).
 *
 * Pre-req: `npm run dev` + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

const DEMO_TIME = new Date('2026-06-26T14:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

test('setas só p/ plantonista + editor com lista de locais e "Outro"', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  await page.clock.setFixedTime(DEMO_TIME);
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });
  const tabLiberacoes = page.getByRole('tab', { name: 'Liberações' });
  await expect(async () => {
    await tabLiberacoes.click();
    await expect(tabLiberacoes).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  // lista carregada (badge do plantonista visível) — e NENHUMA seta p/ não-plantonista
  await expect(page.getByText('Plantonista', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Subir / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Descer / })).toHaveCount(0);

  // editor de linha: Local em DROPDOWN com os locais do hospital + "Outro" abre digitação
  await page.getByRole('button', { name: /^Editar local\/cirurgião/ }).first().click();
  const combo = page.getByRole('combobox').first();
  await expect(combo).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#editor-local')).toHaveCount(0); // sem digitação antes do "Outro"
  await combo.click();
  await expect(page.getByRole('option', { name: 'SRPA', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Exames', exact: true })).toBeVisible();
  await page.getByRole('option', { name: /Outro/ }).click();
  await expect(page.locator('#editor-local')).toBeVisible(); // "Outro" abre o campo livre
});

test('às 22h de dia útil a lista de liberações ZERA (fase noturna)', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  // 26/06/2026 é SEXTA (dia útil); 22h30 → fase 'zerada' (decisão do dono 23/07)
  await page.clock.setFixedTime(new Date('2026-06-26T22:30:00-03:00'));
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });
  const tabLiberacoes = page.getByRole('tab', { name: 'Liberações' });
  await expect(async () => {
    await tabLiberacoes.click();
    await expect(tabLiberacoes).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await expect(page.getByText('Liberações do dia encerradas')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/A lista zera às 22h/)).toBeVisible();
});
