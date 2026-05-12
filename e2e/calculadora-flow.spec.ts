/**
 * E2E: Clinical calculator flow (Holliday-Segar pediátrico)
 *
 * Validates the smoke path for a clinical calculator:
 *   1. Login (calculators require auth)
 *   2. Open Holliday-Segar Pediátrico (id: ped_holliday_segar)
 *      — definition: src/design-system/data/calculator-definitions.js
 *   3. Fill numeric input (peso = 20 kg → expected maintenance fluid = 60 ml/h)
 *   4. Assert result/label visible
 *   5. Assert tabs/InfoBox sections are present
 *
 * Pre-req:
 *   - `npx playwright install` (one-time)
 *   - dev server running: `npm run dev`
 *   - User with Calculadoras permission:
 *       E2E_USER_EMAIL, E2E_USER_PASSWORD
 *
 * Note: ANEST does not use URL routing for calculator deep links — navigation
 * is via switch-based state in App.jsx. This spec navigates through the UI
 * (Menu → Calculadoras → search → open card). If selectors drift, adjust
 * based on the actual ListCalculadorasPage / CalculadoraDetailPage.
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

  test('fill peso → see result + tabs', async ({ page }) => {
    // --- Login ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await page.waitForLoadState('networkidle');

    // --- Menu → Calculadoras ---
    await page.getByRole('button', { name: /menu/i }).first().click();
    await page.waitForLoadState('networkidle');

    const calcEntry = page.getByRole('button', { name: /calculadoras/i }).first();
    await expect(calcEntry).toBeVisible({ timeout: 10_000 });
    await calcEntry.click();
    await page.waitForLoadState('networkidle');

    // --- Open Holliday-Segar ---
    // Search field is typically present
    const search = page.locator('input[type="search"], input[placeholder*="uscar" i], input[placeholder*="ome" i]').first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill('Holliday');
    }

    const card = page.getByText(/Holliday-?Segar/i).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    // --- Fill peso (20 kg) ---
    const pesoInput = page.locator('input[type="number"]').first();
    await expect(pesoInput).toBeVisible({ timeout: 5_000 });
    await pesoInput.fill('20');
    await pesoInput.press('Tab');

    // --- Result element visible ---
    // 20kg → 10*4 + 10*2 = 60 ml/h (Holliday-Segar 4-2-1 rule)
    const result = page.getByText(/(resultado|ml\/h|60)/i).first();
    await expect(result).toBeVisible({ timeout: 5_000 });

    // --- InfoBox tabs/sections present (the 5-section InfoBox is canonical) ---
    const tabs = page.getByRole('tab').or(page.locator('[role="tablist"] button'));
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });
});
