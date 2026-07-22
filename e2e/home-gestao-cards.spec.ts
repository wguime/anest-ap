/**
 * E2E: reorganização Home/Gestão de 2026-07-22 —
 *   - Home SEM o widget de Comunicados e COM o card Escala Cirúrgica
 *     (plantonista do turno por hospital); toque navega p/ /escala-cirurgica.
 *   - Aba Gestão com o card Comunicados IMEDIATAMENTE abaixo da Biblioteca de
 *     Documentos, mesma família/largura (ComunicadosCard modo legado).
 *
 * Determinístico: clock fixo na data da escala DEMO client-side (26/06/2026) —
 * o card da Home mostra os plantonistas da demo sem depender do banco.
 * Screenshots (light+dark @375px) vão p/ E2E_SHOT_DIR (default test-results/).
 *
 * Pre-req: `npm run dev` + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/home-gestao-cards.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';
const SHOT_DIR = process.env.E2E_SHOT_DIR || 'test-results';

const DEMO_TIME = new Date('2026-06-26T14:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

for (const theme of ['light', 'dark'] as const) {
  test(`Home + Gestão @375px — ${theme}`, async ({ page }) => {
    test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
    test.setTimeout(120_000);

    await page.clock.setFixedTime(DEMO_TIME);
    await page.addInitScript((t) => localStorage.setItem('anest-theme', t), theme);

    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

    // ── HOME: card da escala presente (com plantonista da demo), Comunicados ausente
    const cardEscala = page.locator('[data-slot="anest-escala-cirurgica-home-card"]');
    await expect(cardEscala).toBeVisible({ timeout: 15_000 });
    await expect(cardEscala).toContainText('Escala Cirúrgica');
    // plantonista da demo Unimed = ordemLiberacao[0] 'LEONARDO' → titleCase
    await expect(cardEscala).toContainText('Leonardo', { timeout: 15_000 });
    await expect(cardEscala).toContainText(/Matutino|Vespertino/);
    // widget antigo de Comunicados fora da Home
    await expect(page.locator('[data-slot="anest-comunicados-card"]')).toHaveCount(0);

    await page.screenshot({ path: `${SHOT_DIR}/home-${theme}.png`, fullPage: true });

    // toque no card → página da Escala Cirúrgica
    await cardEscala.click();
    await expect(page).toHaveURL(/\/escala-cirurgica$/);
    await expect(page.getByRole('tab', { name: 'Liberações' })).toBeVisible({ timeout: 15_000 });

    // ── GESTÃO: Comunicados logo abaixo da Biblioteca, mesma família/largura
    await page.goto('/gestao');
    const cards = page.locator('[data-slot="anest-comunicados-card"]');
    await expect(cards).toHaveCount(3, { timeout: 15_000 }); // Incidentes, Biblioteca, Comunicados
    await expect(cards.nth(1)).toContainText('Biblioteca de Documentos');
    await expect(cards.nth(2)).toContainText('Comunicados');

    const biblioteca = await cards.nth(1).boundingBox();
    const comunicados = await cards.nth(2).boundingBox();
    expect(biblioteca && comunicados).toBeTruthy();
    expect(comunicados!.width).toBe(biblioteca!.width); // mesma largura (mesmo card)
    expect(comunicados!.y).toBeGreaterThan(biblioteca!.y + biblioteca!.height); // logo abaixo
    expect(comunicados!.y - (biblioteca!.y + biblioteca!.height)).toBeLessThan(24); // sem nada entre

    await page.screenshot({ path: `${SHOT_DIR}/gestao-${theme}.png`, fullPage: true });
  });
}
