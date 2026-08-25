/**
 * E2E visual do FERIADO: reutiliza a tela única do FDS, sem Pn e sem publicar
 * em produção. Os dados vêm da fixture client-side DEV de 25/08/2026.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';
const SCHEME = process.env.E2E_COLOR_SCHEME === 'dark' ? 'dark' : 'light';

test.use({ viewport: { width: 430, height: 932 }, colorScheme: SCHEME });

test('feriado: fila única, 22 nomes, card FDS sem Pn e alerta de anestesista', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date('2026-08-25T10:00:00-03:00') });

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });

  // Tela única: os controles do dia útil não atravessam para o feriado.
  await expect(page.getByRole('tab', { name: 'Minhas' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Unimed' })).toHaveCount(0);

  const cards = page.locator('[data-linha]');
  await expect(cards).toHaveCount(22);
  await expect(page.locator('[data-selo]')).toHaveCount(0); // feriado não tem Pn
  await expect(cards.first()).toContainText('Guilherme Didomenico');
  await expect(cards.last()).toContainText('Fernanda'); // manhã: Fernanda sai primeiro

  const fernanda = page.locator('[data-linha]').filter({ hasText: 'Fernanda' });
  const hospital = fernanda.getByText('Unimed');
  await expect(hospital).toBeVisible();
  await expect(hospital).toHaveClass(/uppercase/); // caixa alta é visual/CSS
  await expect(fernanda).toContainText('Centro Cirúrgico - Sala 2');
  await expect(fernanda).toContainText('Amanda Costa');
  await expect(fernanda.getByText('+ Tempo total')).toBeVisible();
  await expect(fernanda.getByText('Editar')).toBeVisible();

  await expect(page.getByText('Procedimentos sem anestesista')).toBeVisible();
  await expect(page.getByRole('button', { name: /Definir anestesista de Enio Brambatti/i })).toContainText('Adicionar anestesista');

  await page.getByRole('tab', { name: 'Tarde' }).click();
  await expect(cards).toHaveCount(22);
  await expect(cards.first()).toContainText('Fernanda');
  await expect(cards.last()).toContainText('Guilherme Didomenico'); // tarde: último da folha sai primeiro
  await expect(page.locator('[data-selo]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Manhã' }).click();

  await page.screenshot({
    path: `test-results/escala-feriado-fila-unica-430-${SCHEME}.png`,
    fullPage: true,
  });
});
