/**
 * E2E: modo FIM DE SEMANA da Escala Cirúrgica — fila de liberação ÚNICA
 * (dono 15/08). Determinístico: relógio congelado no sábado da escala DEMO FDS
 * (27/06/2026, fixture client-side em DEV — carrega quando o banco não tem
 * escala nessa data), viewport mobile 375px.
 *
 * Cobre o essencial do modo:
 *  - as abas de dia útil existem no FDS (dono 13/09); na Liberações o seletor de
 *    hospital some (a fila é única) e na Completa ele volta;
 *  - o bloco "sem anestesista" da fila única é por CIRURGIÃO (dono 13/09);
 *  - a fila segue o rodapé publicado (invertido do documento) com badge Pn;
 *  - "Próximo a ser liberado" cruza hospitais (Matheus fecha o rodapé com caso
 *    no HRO);
 *  - plantão físico da faixa 7-13 (grade) badgeado em vez do "Plantonista".
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/escala-cirurgica-fds.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

// 10:00 BRT do sábado da demo FDS — faixa 7-13 da grade
const DEMO_FDS_TIME = new Date('2026-06-27T10:00:00-03:00');

// E2E_COLOR_SCHEME=dark roda a MESMA verificação no tema escuro (dual theme)
const SCHEME = process.env.E2E_COLOR_SCHEME === 'dark' ? 'dark' : 'light';
test.use({ viewport: { width: 375, height: 812 }, colorScheme: SCHEME });

test('fila única do FDS: rótulo, badges Pn, plantão físico e próximo cross-hospital', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  await page.clock.install({ time: DEMO_FDS_TIME });

  await page.goto('/');
  await page.locator('input[autocomplete="email"]').first().fill(E2E_USER_EMAIL);
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

  // 13/09: as abas de dia útil existem no FDS; na Liberações o seletor de
  // hospital SOME (a fila é única e ele não filtraria nada) e volta na Completa
  await expect(page.getByRole('tab', { name: 'Completa' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Unimed' })).toHaveCount(0);

  // "sem anestesista" por CIRURGIÃO na fila única: um card por cirurgião +
  // hospital, com a ação de assumir o grupo como frase abaixo do texto
  const grupo = page.getByRole('group', { name: /Franco Foresti: 2 procedimentos sem anestesista/ });
  await expect(grupo).toBeVisible({ timeout: 15_000 });
  await expect(grupo).toContainText('HRO');
  await expect(grupo).toContainText('Toque para assumir os 2 procedimentos');
  // e NÃO um card por procedimento (o desenho de dia útil)
  await expect(page.getByText('Toque para definir o anestesista')).toHaveCount(0);

  // rodapé invertido do doc: 12 posições; a 1ª é P1 (sai por último) e a última
  // é P4 (sai primeiro). Badge Pn vem do data-selo do card.
  const cards = page.locator('[data-linha]');
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-selo="P1"]')).toHaveCount(1);
  await expect(page.locator('[data-selo="P12"]')).toHaveCount(1);

  // plantão físico da faixa 7-13 (grade): Unimed = P1, HRO = P2
  await expect(page.getByText('Plantão Unimed')).toBeVisible();
  await expect(page.getByText('Plantão HRO')).toBeVisible();

  // próximo a ser liberado = quem fecha o rodapé (P4/Matheus), cujo caso é do
  // HRO — a fila cruza hospitais
  const cardP4 = page.locator('[data-selo="P4"]');
  await expect(cardP4).toContainText('Próximo a ser liberado');
  await expect(cardP4).toContainText('HRO');

  // registro visual (rodar 2× com E2E_COLOR_SCHEME=light|dark cobre o dual theme)
  await page.screenshot({ path: `test-results/escala-fds-fila-unica-375-${SCHEME}.png`, fullPage: true });

  // a Completa por hospital no fim de semana (dono 13/09): o seletor volta e o
  // quadro por sala é o de dia útil
  const tabCompleta = page.getByRole('tab', { name: 'Completa' });
  await expect(async () => {
    await tabCompleta.click();
    await expect(tabCompleta).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByRole('tab', { name: 'Unimed' })).toBeVisible();
  await page.screenshot({ path: `test-results/escala-fds-completa-375-${SCHEME}.png`, fullPage: true });
});
