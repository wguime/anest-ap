/**
 * E2E: Clinical calculator flow (Holliday-Segar pediátrico)
 *
 * Validates the smoke path for a clinical calculator:
 *   1. Login (calculators require auth)
 *   2. Menu tab → widget "Calculadoras" → busca (lupa no header) → "Holliday"
 *   3. Open "Holliday-Segar Pediátrico" (id: ped_holliday_segar)
 *      — definition: src/design-system/data/calculator-definitions.js
 *   4. Fill peso = 20 kg → horária 4-2-1: 40 + (20-10)*2 = 60.0 mL/h;
 *      diária 100-50-20: 1000 + 50*(20-10) = 1500 mL/24h
 *      (a 4-2-1 é aproximação horária da regra diária — 60×24=1440 ≠ 1500;
 *      display: HollidaySegarDisplay em CalculatorShowcase.jsx)
 *   5. Assert result cards ("Manutencao" 60.0 mL/hora, "Volume 24h" 1500 mL/dia)
 *   6. Assert InfoBox "Pontos-Chave" — a página de detalhe é SEM TABS por design
 *      (CalculatorShowcase.jsx: "LAYOUT POR SECOES (SEM TABS)"), então NÃO
 *      assertamos role=tab.
 *
 * Pre-req:
 *   - `npx playwright install` (one-time)
 *   - dev server running: `npm run dev`
 *   - User with Calculadoras permission:
 *       E2E_USER_EMAIL, E2E_USER_PASSWORD
 *
 * Note: ANEST does not use URL routing for calculator deep links — navigation
 * is via switch-based state in App.jsx. This spec navigates through the UI
 * (bottom nav Menu → Calculadoras → search → open card).
 *
 * Run:
 *   npm run e2e -- e2e/calculadora-flow.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

test.describe('Calculadora — Holliday-Segar', () => {
  test.skip(
    !E2E_USER_EMAIL || !E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL / E2E_USER_PASSWORD to run calculadora specs',
  );

  test('fill peso → see result + InfoBox', async ({ page }) => {
    // --- Login (padrão canônico do auth.spec) ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // NÃO usar waitForLoadState('networkidle'): a home mantém conexões
    // realtime abertas (Supabase/websockets) e a rede nunca fica idle.
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({
      timeout: 20_000,
    });

    // --- Bottom nav → Menu ---
    const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
    await bottomNav.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible({ timeout: 10_000 });

    // --- Widget "Calculadoras" (WidgetCard renderiza <button>) ---
    await page.getByRole('button', { name: /Calculadoras/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Calculadoras' })).toBeVisible({
      timeout: 10_000,
    });

    // --- Busca: lupa no header (SearchToggleButton) abre SearchBar collapsible ---
    await page.getByRole('button', { name: 'Abrir busca' }).click();
    const search = page.getByPlaceholder('Buscar calculadora...');
    await expect(search).toBeVisible({ timeout: 5_000 });
    await search.fill('Holliday');

    // --- Open Holliday-Segar Pediátrico (a duplicata 'hemo_holliday' é inactive) ---
    const card = page.getByRole('button', { name: /Holliday-Segar Pediátrico/ }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    // --- Fill peso (20 kg) — input interno do HollidaySegarDisplay ---
    const pesoInput = page.locator('input[type="number"]').first();
    await expect(pesoInput).toBeVisible({ timeout: 10_000 });
    await pesoInput.fill('20');

    /* --- Result: 20 kg → 60,0 mL/hora (4-2-1) e 1.500 mL/dia (100-50-20) ---
     * ⚠️ Vírgula decimal e ponto de milhar desde 31/08/2026 (commit 0848cd1).
     * Este teste ficou vermelho na migração e o run daquele dia deu VERDE
     * FALSO: o dev server servia o módulo de dados antigo em memória. Ao
     * verificar formatação por e2e, reiniciar o dev server antes. */
    await expect(page.getByText('Manutencao', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('60,0', { exact: true })).toBeVisible();
    await expect(page.getByText('mL/hora', { exact: true })).toBeVisible();
    await expect(page.getByText('1.500', { exact: true })).toBeVisible();
    await expect(page.getByText('mL/dia', { exact: true })).toBeVisible();

    // --- InfoBox: seção "Pontos-Chave" (colapsível, aberta por default) ---
    // A página de detalhe NÃO tem tabs — assertamos o InfoBox canônico.
    await expect(page.getByRole('heading', { name: 'Pontos-Chave' })).toBeVisible();
    await expect(page.getByText('Primeiros 10 kg: 4 mL/kg/h')).toBeVisible();
  });
});
