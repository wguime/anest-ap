/**
 * E2E: TROCA DECLARADA (dono 30/07) — declarar → badge nos dois lados → executar
 * (um toque) → quem assume ocupa a POSIÇÃO do colega → desfazer.
 *
 * Determinístico por construção: escala DEMO (26/06/2026) client-side, e as
 * actions de troca operam EM MEMÓRIA no demo (padrão do toggleLiberacao) — nada
 * é escrito no banco. O rodapé demo do HRO tem GIOVANA e MAURICIO, o par do
 * caso real que motivou a feature.
 *
 * Pre-req: `npm run dev` de pé + creds no env (source ~/.anest-e2e.env, nunca cat).
 * Rodar:   npx playwright test e2e/escala-cirurgica-troca.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

// 14:00 BRT do dia da escala demo (vespertino)
const DEMO_TIME = new Date('2026-06-26T14:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

test('declarar → badge nos 2 lados → executar (posição+casos) → desfazer', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(180_000);

  await page.clock.install({ time: DEMO_TIME });

  // Login (fluxo do auth.spec; sem networkidle — realtime nunca fica idle)
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });

  // HRO (o rodapé demo tem GIOVANA e MAURICIO) → aba Liberações
  await page.getByRole('tab', { name: 'HRO' }).click();
  const tabLiberacoes = page.getByRole('tab', { name: 'Liberações' });
  await expect(async () => {
    await tabLiberacoes.click();
    await expect(tabLiberacoes).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  // data-nome = nome EXIBIDO da linha (hasText pegaria cirurgião homônimo —
  // "Mauricio Sanagiotto" opera na Sala 2 do demo)
  const linhaGiovana = page.locator('[data-nome="Giovana Noll"]');
  const linhaMauricio = page.locator('[data-nome="Mauricio Bastos"]');
  await expect(linhaGiovana).toBeVisible({ timeout: 15_000 });

  // ── 1. DECLARAR pelo ✏️ da linha da Giovana ────────────────────────────────
  await page.getByLabel(/Editar local\/cirurgião de Giovana/).click();
  await page.getByRole('button', { name: /Marcar troca com um colega/ }).click();
  // Select searchable do roster: busca e escolhe o Mauricio (nome do cadastro).
  // Retry no abrir (toPass): o clique durante a animação do sheet não registra.
  const trigger = page.getByRole('combobox').filter({ hasText: /colega da troca/i });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await expect(async () => {
    await trigger.click();
    await expect(page.getByPlaceholder('Buscar...')).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await page.getByPlaceholder('Buscar...').fill('mauric');
  await page.getByRole('option', { name: /mauricio/i }).first().click();
  await page.getByRole('button', { name: 'Marcar troca', exact: true }).click();

  // ── 2. BADGE nos DOIS lados do par ────────────────────────────────────────
  await expect(linhaGiovana.getByText('Troca', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(linhaMauricio.getByText('Troca', { exact: true })).toBeVisible();
  await expect(linhaGiovana.getByText(/Trocado com/)).toBeVisible();
  await page.screenshot({ path: 'e2e/__screenshots__/troca-declarada-badges.png', fullPage: true });

  // ── 3. EXECUTAR (um toque) do painel da linha do Maurício ─────────────────
  await page.getByLabel('Editar local/cirurgião de Mauricio Bastos').click();
  await page.getByRole('button', { name: /Executar troca — .* assume aqui/ }).click();

  // Par no MESMO hospital → swap simultâneo dos DOIS slots: o slot do Maurício
  // exibe a Giovana e o dela exibe o Maurício — as CHAVES dos slots não mudam,
  // ninguém vira linha extra e a ordem do rodapé segue intocada.
  await expect(page.getByText(/Substituição executada/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Assumiu a posição de Mauricio Bastos/)).toBeVisible();
  await expect(page.getByText(/Assumiu a posição de Giovana Noll/)).toBeVisible();
  // o badge Troca some dos dois lados após a execução
  await expect(page.locator('[data-linha]').getByText('Troca', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'e2e/__screenshots__/troca-executada-posicao.png', fullPage: true });

  // ── 4. DESFAZER a substituição (caminho de erro humano) ───────────────────
  await page.getByLabel('Editar local/cirurgião de Giovana Noll').click();
  await page.getByRole('button', { name: /Desfazer substituição/ }).click();
  await expect(page.getByText(/Substituição desfeita/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Assumiu a posição de/)).toHaveCount(0);
});
