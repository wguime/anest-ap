/**
 * E2E: TROCA (fluxo único) — escolher o colega → CONFIRMAR de onde cada um sai
 * (dono 09/08: a escala pode vir publicada já com os nomes trocados) → trocar
 * no ato → quem assume ocupa a POSIÇÃO do colega, com badge nos dois → desfazer.
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

test('confirmar origem → trocar agora (posição+casos) → badge nos 2 lados → desfazer', async ({ page }) => {
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

  // Abre o painel da linha e toca num botão dele, tolerando o tap que cai no
  // OVERLAY durante a animação de subida do sheet (fecha o painel sem registrar
  // o toque — mesma classe do toPass do Select logo abaixo; ficou determinístico
  // no mobile quando o painel encurtou em 31/07): se o botão sumiu, reabre e
  // tenta de novo; se o efeito já aconteceu numa tentativa anterior, não repete.
  const noPainel = async (labelEditar: string | RegExp, botao: RegExp, jaDeuCerto: () => Promise<boolean>) => {
    await expect(async () => {
      if (await jaDeuCerto().catch(() => false)) return;
      const alvo = page.getByRole('button', { name: botao });
      if (!(await alvo.isVisible().catch(() => false))) {
        await page.getByLabel(labelEditar).click({ timeout: 2_000 });
        await expect(alvo).toBeVisible({ timeout: 3_000 });
      }
      await alvo.click({ timeout: 2_000 });
      await expect(async () => expect(await jaDeuCerto()).toBe(true)).toPass({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  };

  // ── 1. TROCAR pelo FLUXO ÚNICO (dono 07/08): o ✏️ abre o TrocaSheet, que
  // pede a ORIGEM de cada um (dono 09/08 — a escala pode vir já trocada),
  // infere o tipo e executa no ato ("Declarar para depois" saiu em 09/08).
  // Retry no abrir (toPass): o clique durante a animação do sheet não registra.
  const trigger = page.getByRole('combobox').filter({ hasText: /Escolha o colega/i });
  await noPainel(/Editar local\/cirurgião de Giovana/, /Trocar com um colega/,
    () => trigger.isVisible());
  await expect(async () => {
    await trigger.click();
    await expect(page.getByPlaceholder('Buscar...')).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await page.getByPlaceholder('Buscar...').fill('mauric');
  await page.getByRole('option', { name: /mauricio/i }).first().click();

  // ── 2. CONFIRMAR a origem dos dois (nada vem pré-marcado) ─────────────────
  // Os dois são do HRO no demo → um chip "HRO · <turno>" por pessoa.
  const chipsHro = page.getByRole('button', { name: /^HRO · / });
  await expect(chipsHro).toHaveCount(2, { timeout: 5_000 });
  await chipsHro.nth(0).click();
  await chipsHro.nth(1).click();
  // tipo INFERIDO das posições confirmadas (mesmo hospital → posições)
  await expect(page.getByRole('button', { name: 'Troca de posições' }))
    .toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
  await expect(page.getByText(/assume a posição de Giovana/i)).toBeVisible();
  await page.screenshot({ path: 'e2e/__screenshots__/troca-sheet-origem.png', fullPage: true });
  await page.getByRole('button', { name: /Trocar agora/ }).click();

  // ── 3. Par no MESMO hospital → swap simultâneo dos DOIS slots: o slot do
  // Maurício exibe a Giovana e o dela exibe o Maurício — as CHAVES dos slots
  // não mudam, ninguém vira linha extra e a ordem do rodapé segue intocada.
  await expect(linhaGiovana.getByText('Troca', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(linhaMauricio.getByText('Troca', { exact: true })).toBeVisible();
  await expect(page.getByText(/Assumiu a posição de Mauricio Bastos/)).toBeVisible();
  await expect(page.getByText(/Assumiu a posição de Giovana Noll/)).toBeVisible();
  await page.screenshot({ path: 'e2e/__screenshots__/troca-executada-posicao.png', fullPage: true });

  // ── 4. DESFAZER a substituição (caminho de erro humano) ───────────────────
  await noPainel('Editar local/cirurgião de Giovana Noll', /Desfazer troca/,
    () => page.getByText(/Troca desfeita/).isVisible());
  await expect(page.getByText(/Troca desfeita/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Assumiu a posição de/)).toHaveCount(0);
});
