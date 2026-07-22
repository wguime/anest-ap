/**
 * E2E visual: Escala Cirúrgica — 3 abas × light/dark @ 375px.
 *
 * Determinismo por construção:
 *   - `page.clock.setFixedTime(20/07/2026 14:00 BRT)` → o app acredita que "hoje"
 *     é o dia da seed FIXA (`created_by='seed-teste-claude-20'`, imóvel por
 *     contrato) e carrega esse board sem navegar o DatePicker; o cronômetro da
 *     aba Liberações congela; `turnoAtual()` (14h) → "Tarde" sempre.
 *   - Tema via localStorage `anest-theme` (mesma chave do useTheme) ANTES do load.
 *   - Gate do piloto abre em DEV (import.meta.env.DEV) — rodar contra dev server.
 *     A RLS exige papel clínico: o user E2E é anestesiologista (verificado 21/07).
 *
 * Pre-req: `npm run dev` de pé + creds no env (source ~/.anest-e2e.env, nunca cat).
 * Rodar:    npx playwright test e2e/escala-cirurgica-visual.spec.ts --project=chromium
 * Baseline: mesmo comando com --update-snapshots (commitar os PNGs no PR da mudança).
 * Baseline quebrou sem mudança de código → alguém alterou os STATUS da seed-20 no
 * banco (eles pintam os cards) — conferir antes de regenerar.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

// 14:00 BRT do dia da seed fixa
const FIXED_TIME = new Date('2026-07-20T14:00:00-03:00');

const ABAS = [
  { tab: 'Minhas', slug: 'minhas' },
  { tab: 'Completa', slug: 'board' },
  { tab: 'Liberações', slug: 'liberacoes' },
] as const;

test.use({ viewport: { width: 375, height: 667 } });

for (const theme of ['light', 'dark'] as const) {
  test(`3 abas @ 375px — ${theme}`, async ({ page }) => {
    // PAUSADO 2026-07-22: a fixture (seed-teste-claude-20) foi APAGADA na liberação
    // ao grupo (checklist aprovado — o grupo não pode ver escala de teste). Reativar
    // exige nova estratégia determinística (ex.: escala demo client-side ou fixture
    // criada/destruída pelo próprio spec). Baselines mantidos como referência.
    test.skip(true, 'fixture seed-20 removida na liberação ao grupo — aguarda nova fixture');
    test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
    test.setTimeout(120_000);

    await page.clock.setFixedTime(FIXED_TIME);
    await page.addInitScript((t) => localStorage.setItem('anest-theme', t), theme);

    // Login (mesmo fluxo do auth.spec; sem networkidle — realtime nunca fica idle)
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/escala-cirurgica');
    await expect(page.getByRole('tab', { name: 'Completa' })).toBeVisible({ timeout: 15_000 });
    // Board da seed-20 carregado = existem salas (garante que a escala veio do banco)
    await page.getByRole('tab', { name: 'Completa' }).click();
    await expect(page.getByText(/sala/i).first()).toBeVisible({ timeout: 15_000 });

    for (const { tab, slug } of ABAS) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(1_000); // animações de troca de aba + realtime settle
      await expect(page).toHaveScreenshot(`${slug}-${theme}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    }
  });
}
