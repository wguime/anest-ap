/**
 * E2E visual: entrada de FIM DE SEMANA com os mapas cirúrgicos (dono 2026-08-22).
 * Só abre a tela e fotografa nos dois temas — a lógica tem teste de unidade
 * (importarEscalaFdsMapas.test.jsx). Serve à regra da casa: mudança visual é
 * conferida no browser antes de sair.
 *
 * Pre-req: `npm run dev` + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';
const SCHEME = process.env.E2E_COLOR_SCHEME === 'dark' ? 'dark' : 'light';
test.use({ viewport: { width: 430, height: 932 }, colorScheme: SCHEME });

test('lista de documentos do fim de semana', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await page.getByRole('button', { name: /Importar|Confeccionar/i }).first().click();
  await page.getByRole('button', { name: /documento de FDS|fila única/i }).first().click();

  await expect(page.getByRole('heading', { name: 'Fim de semana', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Posições e fila')).toBeVisible();
  await page.screenshot({ path: `.tmp/fds-lista-${SCHEME}.png`, fullPage: true });
});
