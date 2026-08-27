/**
 * E2E: LOTE do dia útil (dono 2026-08-27) — a tela de importação passa a aceitar
 * as escalas dos hospitais de uma vez, com uma aba de conferência por hospital.
 *
 * Cobre o que só o app real prova: a tela nova monta dentro do fluxo (Escala
 * Cirúrgica → Importar), o header segue o padrão do DS (título + subtítulo com
 * data e turno) e a caixa de anexo aceita MÚLTIPLOS arquivos. A conferência em
 * abas e a folha de revisão têm cobertura de integração em
 * `src/__tests__/pages/importarEscalasLote.test.jsx` — aqui não se chama a
 * Vision de propósito (custo por leitura e dependência de crédito da conta).
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/importar-escalas-lote.spec.ts --project=chromium
 *          E2E_COLOR_SCHEME=dark npx playwright test e2e/importar-escalas-lote.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

const SCHEME = process.env.E2E_COLOR_SCHEME === 'dark' ? 'dark' : 'light';
test.use({ viewport: { width: 430, height: 839 }, colorScheme: SCHEME });

test('importação em lote: anexo múltiplo e header no padrão do DS', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByRole('button', { name: /importar/i }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /importar/i }).first().click();

  // Header no padrão do PageHeader: título + subtítulo com data e turno
  await expect(page.getByRole('heading', { name: 'Confeccionar escalas' })).toBeVisible();
  await expect(page.getByText(/·\s*(Matutino|Vespertino)/)).toBeVisible();

  // A caixa de anexo aceita vários arquivos de uma vez
  const input = page.locator('input[type="file"]').first();
  await expect(input).toHaveAttribute('multiple', '');
  await expect(page.getByText(/Pode soltar todos de uma vez/i)).toBeVisible();

  // Data e período seguem no cartão, um turno por vez (o dono anexa assim)
  await expect(page.getByText('Para qual escala')).toBeVisible();

  await page.screenshot({ path: `.tmp/e2e-lote-${SCHEME}.png` });
});
