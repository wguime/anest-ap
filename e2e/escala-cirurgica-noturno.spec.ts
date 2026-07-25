/**
 * E2E: fase noturna das Liberações (redesenho do dono 2026-07-24).
 *
 * Das 19h às 23h cada plantonista noturno vira um CARD da lista, com selo
 * P1–P4 ANTES do nome, e a lista vespertina segue ABAIXO. Ordem por hospital:
 *   HRO     → P1 → P4 → vespertina
 *   Unimed  → P2 → P3 → P4 → vespertina
 *   Materno → P4
 * O P4 é coringa: sem marcação aparece nos TRÊS.
 *
 * Determinístico por construção:
 *   - `page.clock.setFixedTime` em 26/06/2026 20h (SEXTA, dentro da janela
 *     19h–23h) → carrega a escala DEMO client-side (o banco não tem escala
 *     nessa data) e a fase é 'noite' sem depender de dado real.
 *   - a chamada ao PegaPlantao é ABORTADA de propósito: o hook cai no mock de
 *     dia útil (P1 Eduardo Savoldi · P2 Klisman Drescher · P3 Cristina Barbosa
 *     · P4 G. Melo), então os P1–P4 não dependem do plantão real do dia.
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/escala-cirurgica-noturno.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

// 20h do dia da escala demo (26/06/2026 é SEXTA) → fase 'noite' (19h–23h)
const NOITE = new Date('2026-06-26T20:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

/** Login + escala demo carregada + aba Liberações aberta. */
async function abrirLiberacoes(page: Page) {
  await page.clock.setFixedTime(NOITE);
  // sem plantão real: o hook cai no mock de dia útil (P1–P4 fixos)
  await page.route('**/functions/v1/pegaplantao-proxy**', (r) => r.abort());

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });
  // Radix Tabs perde o 1º clique durante a hidratação — retry até aria-selected
  const tab = page.getByRole('tab', { name: 'Liberações' });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator('[data-linha]').first()).toBeVisible({ timeout: 15_000 });
}

/** Troca o hospital exibido (seletor segmentado no topo). */
async function irPara(page: Page, hospital: 'Unimed' | 'HRO' | 'Materno') {
  const pill = page.getByRole('tab', { name: hospital, exact: true });
  await expect(async () => {
    await pill.click();
    await expect(pill).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await expect(page.locator('[data-linha]').first()).toBeVisible({ timeout: 10_000 });
}

/** Selo de cada card, na ordem da lista ('—' = card comum da vespertina). */
async function ordemDosSelos(page: Page): Promise<string[]> {
  return page.locator('[data-linha]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.selo || '—')
  );
}

test.describe('Liberações — fase noturna 19h–23h', () => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');

  test('ordem por hospital: HRO P1→P4 · Unimed P2→P3→P4 · Materno P4', async ({ page }) => {
    test.setTimeout(180_000);
    await abrirLiberacoes(page);

    // ── Unimed: P2 → P3 → P4 → vespertina ──────────────────────────────────
    await irPara(page, 'Unimed');
    const unimed = await ordemDosSelos(page);
    expect(unimed.slice(0, 3)).toEqual(['P2', 'P3', 'P4']);
    expect(unimed.slice(3).every((s) => s === '—')).toBe(true);
    expect(unimed.length).toBeGreaterThan(3); // a vespertina segue ABAIXO
    await page.screenshot({ path: 'e2e/__screenshots__/noturno-unimed.png', fullPage: true });

    // ── HRO: P1 → P4 → vespertina ──────────────────────────────────────────
    await irPara(page, 'HRO');
    const hro = await ordemDosSelos(page);
    expect(hro.slice(0, 2)).toEqual(['P1', 'P4']);
    expect(hro.slice(2).every((s) => s === '—')).toBe(true);
    expect(hro.length).toBeGreaterThan(2);
    await page.screenshot({ path: 'e2e/__screenshots__/noturno-hro.png', fullPage: true });

    // ── Materno: P4 é o plantonista ────────────────────────────────────────
    await irPara(page, 'Materno');
    const materno = await ordemDosSelos(page);
    expect(materno[0]).toBe('P4');
    expect(materno.slice(1).every((s) => s === '—')).toBe(true);
    await page.screenshot({ path: 'e2e/__screenshots__/noturno-materno.png', fullPage: true });
  });

  test('selos P1–P4 visíveis e a CAIXA AZUL do plantão noturno não existe mais', async ({ page }) => {
    test.setTimeout(180_000);
    await abrirLiberacoes(page);
    await irPara(page, 'Unimed');

    for (const selo of ['P2', 'P3', 'P4']) {
      await expect(page.locator(`[data-selo="${selo}"]`)).toHaveCount(1);
      await expect(page.locator(`[data-selo="${selo}"]`).getByText(selo, { exact: true })).toBeVisible();
    }
    // a caixa azul tinha este título; os cards não o têm
    await expect(page.getByText(/Plantão noturno · 19h–22h/)).toHaveCount(0);
  });

  test('P4 é coringa: aparece nos três até ser marcado', async ({ page }) => {
    test.setTimeout(180_000);
    await abrirLiberacoes(page);

    for (const h of ['Unimed', 'HRO', 'Materno'] as const) {
      await irPara(page, h);
      await expect(page.locator('[data-selo="P4"]'), `P4 deve aparecer no ${h}`).toHaveCount(1);
    }
    // o selo do P4 é o botão que abre a definição do hospital
    await expect(page.getByLabel('Definir em qual hospital o P4 está hoje')).toBeVisible();
  });
});
