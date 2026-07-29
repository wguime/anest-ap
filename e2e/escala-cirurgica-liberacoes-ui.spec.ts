/**
 * E2E: regras de UI da aba Liberações (pedidos do dono 2026-07-22 e 27/07) —
 *   - Reordenar NÃO EXISTE MAIS (27/07): a ordem do rodapé é imutável no app e as
 *     setas Subir/Descer saíram da tela para todo mundo, plantonista incluído.
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

test('sem setas de reordenar + editor com lista de locais e "Outro"', async ({ page }) => {
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

  // lista carregada (badge do plantonista visível) — e NENHUMA seta p/ ninguém
  await expect(page.getByText('Plantonista', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Subir / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Descer / })).toHaveCount(0);

  // editor de linha: Local em DROPDOWN com os locais do hospital + "Outro" abre digitação
  await page.getByRole('button', { name: /^Editar local\/cirurgião/ }).first().click();
  // pelo id: desde 29/07 o painel da linha também tem o combobox de hora exata
  const combo = page.locator('#editor-local-select');
  await expect(combo).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#editor-local')).toHaveCount(0); // sem digitação antes do "Outro"
  await combo.click();
  await expect(page.getByRole('option', { name: 'SRPA', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Exames', exact: true })).toBeVisible();
  await page.getByRole('option', { name: /Outro/ }).click();
  await expect(page.locator('#editor-local')).toBeVisible(); // "Outro" abre o campo livre
});

test('às 23h de dia útil a lista do dia ZERA e ficam só os plantonistas P1–P4', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  // 26/06/2026 é SEXTA (dia útil); 23h30 → fase 'zerada' (corte movido de 22h
  // para 23h pelo dono em 24/07, mantendo os P1–P4 na tela).
  await page.clock.setFixedTime(new Date('2026-06-26T23:30:00-03:00'));
  // sem plantão real: o hook cai no mock de dia útil (P1–P4 fixos)
  await page.route('**/functions/v1/pegaplantao-proxy**', (r) => r.abort());
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

  // Unimed às 23h: SÓ os cards P2/P3/P4, nada da lista vespertina
  await expect(page.locator('[data-linha]').first()).toBeVisible({ timeout: 15_000 });
  const selos = await page.locator('[data-linha]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.selo || '—')
  );
  expect(selos).toEqual(['P2', 'P3', 'P4']);
});
