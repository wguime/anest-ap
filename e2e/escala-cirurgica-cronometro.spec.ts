/**
 * E2E: cronômetro da aba Liberações VIVO (bug de produção 2026-07-22 — pills
 * congeladas: iOS/PWA suspende timers em background e pode nunca retomá-los).
 *
 * Determinístico por construção: `page.clock.install` na data da escala DEMO
 * client-side (26/06/2026 — carrega quando o banco não tem escala nessa data),
 * sem depender de fixture no banco.
 *
 * Cobre os dois cenários:
 *   1. Foreground: `clock.fastForward(2min)` dispara o intervalo de 30s → o
 *      texto da pill muda sem reload.
 *   2. Voltar do segundo plano: `clock.setSystemTime` avança o relógio SEM
 *      disparar timer nenhum (exatamente o que a suspensão faz) → pill fica
 *      stale → `visibilitychange` recalcula na hora (fix useAgoraMinuto).
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/escala-cirurgica-cronometro.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

// 14:00 BRT do dia da escala de demonstração (vespertino — casos 13:30+duração)
const DEMO_TIME = new Date('2026-06-26T14:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

test('pill do cronômetro avança com o tempo e recalcula ao voltar do background', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  // install (não setFixedTime): o relógio continua correndo e é CONTROLÁVEL
  // (fastForward / setSystemTime) — necessário p/ provar o tick.
  await page.clock.install({ time: DEMO_TIME });

  // Login (mesmo fluxo do auth.spec; sem networkidle — realtime nunca fica idle)
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  // escala demo carregada ANTES de trocar de aba (clique cedo demais não registra)
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });
  const tabLiberacoes = page.getByRole('tab', { name: 'Liberações' });
  await expect(async () => {
    await tabLiberacoes.click();
    await expect(tabLiberacoes).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  // Cronômetro é 100% MANUAL (decisão 23/07): nasce em branco — preenche via
  // "Tempo faltante" (1 toque em 1h) e só então a pill aparece e conta.
  await expect(page.locator('button[title*="toque para ajustar"]')).toHaveCount(0);
  await page.getByRole('button', { name: /^Definir tempo faltante de/ }).first().click();
  await page.getByRole('button', { name: '1h', exact: true }).click();
  const pill = page.locator('button[title*="toque para ajustar"]').first();
  await expect(pill).toBeVisible({ timeout: 10_000 });
  const antes = (await pill.textContent())?.trim(); // ~1h
  expect(antes).toBeTruthy();

  // 1) FOREGROUND: +2min de relógio DISPARANDO os timers → o intervalo tica
  await page.clock.fastForward(2 * 60_000);
  await expect(pill).not.toHaveText(antes!, { timeout: 5_000 });
  const aposTick = (await pill.textContent())?.trim();

  // 2) BACKGROUND→RESUME: +1h SEM disparar nenhum timer (suspensão iOS)…
  await page.clock.setSystemTime(new Date(DEMO_TIME.getTime() + 62 * 60_000));
  await page.waitForTimeout(300); // qualquer re-render pendente
  await expect(pill).toHaveText(aposTick!); // …stale: nada recalculou sozinho

  // …e o visibilitychange (voltar ao app) recalcula NA HORA, sem esperar tick
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(pill).not.toHaveText(aposTick!, { timeout: 3_000 });
});
