/**
 * E2E: o detalhe do caso TEM de rolar até o fim (regressão de 29/07).
 *
 * O painel do Sheet tem altura FIXA (85vh) e `overflow-hidden`. Quando o sheet
 * do caso ganhou três blocos novos (tempo da cirurgia, residente, ajuda), os
 * controles do fim — os status extras Atrasada / Suspensa / Passa para tarde —
 * saíram da área visível SEM barra de rolagem: não dava para vê-los nem para
 * alcançá-los, e o dono relatou "informações escondidas" com o centro cirúrgico
 * em andamento.
 *
 * jsdom não mede layout, então o teste unitário só trava a estrutura. Este aqui
 * é o que prova o comportamento: mede scrollHeight × clientHeight no corpo do
 * sheet a 375px e rola até o último controle.
 *
 * Determinístico: escala DEMO client-side (26/06/2026, carrega quando o banco
 * não tem escala nessa data) — mesmo caminho do spec do cronômetro, sem fixture.
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/escala-cirurgica-sheet-scroll.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

const DEMO_TIME = new Date('2026-06-26T14:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

test('detalhe do caso rola até os status do fim', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  // setFixedTime (e não clock.install): install assume os timers e o app não
  // chega a trocar de aba — o spec de Liberações já usa este caminho.
  await page.clock.setFixedTime(DEMO_TIME);

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');

  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });

  // a aba inicial é "Minhas" e o usuário e2e não está escalado — os casos do
  // board todo vivem na Completa. O clique precisa de retry: o primeiro não
  // registra (mesmo padrão já contornado nos specs de Liberações).
  const tabCompleta = page.getByRole('tab', { name: 'Completa' });
  await expect(async () => {
    await tabCompleta.click();
    await expect(tabCompleta).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  const caso = page.getByRole('button', { name: /^Detalhes do caso/ }).first();
  await expect(caso).toBeVisible({ timeout: 20_000 });
  await caso.click();

  const corpo = page.locator('[data-slot="sheet-body"]');
  await expect(corpo).toBeVisible({ timeout: 10_000 });

  // Tela baixa para garantir o cenário: o painel é 85vh, então encurtar a
  // viewport põe o conteúdo para fora dele sem depender de quantos blocos o
  // caso tem. (No demo o sheet é read-only — os três blocos que estouraram a
  // tela do dono são gated em `podeEditarCaso` e não renderizam aqui, e o
  // conteúdo restante mede ~261px: a 812 e a 460 de viewport ele ainda CABE no
  // painel, e o teste passaria por vacuidade.)
  await page.setViewportSize({ width: 375, height: 300 });

  // 1. o conteúdo REALMENTE passa da altura do painel — é a pré-condição do
  //    corte. Se um dia deixar de passar, o teste avisa que parou de exercitar
  //    o cenário em vez de passar por vacuidade.
  const medida = async () => corpo.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  const { scrollHeight, clientHeight, overflowY } = await medida();
  expect(scrollHeight).toBeGreaterThan(clientHeight);

  // 2. e o corpo é container de rolagem DE VERDADE no browser — era isto que
  //    faltava: `overflow-hidden` cortava sem barra e sem aviso.
  expect(overflowY).toBe('auto');

  // 3. dá para chegar no fim do conteúdo
  const ultimo = corpo.locator(':scope > *').last();
  await ultimo.scrollIntoViewIfNeeded();
  const rolou = await corpo.evaluate((el) => el.scrollTop);
  expect(rolou).toBeGreaterThan(0);
});
