/**
 * E2E: Quiz answer persistence offline → sync online
 *
 * Validates the offline-first behaviour of the quiz attempt flow:
 *   1. User opens a quiz attempt while online
 *   2. Network goes offline
 *   3. User answers 2 questions — responses persist locally
 *   4. Network goes back online
 *   5. No error banner appears; responses remain visible (synced)
 *
 * Pre-req:
 *   - `npx playwright install` (one-time)
 *   - dev server running: `npm run dev`
 *   - Test user with Educação access:
 *       E2E_USER_EMAIL, E2E_USER_PASSWORD
 *   - At least one published quiz with ≥2 questions available to the user
 *
 * Run:
 *   npm run e2e -- e2e/quiz-offline.spec.ts
 *
 * Note: this spec is sensitive to the educação trilha structure. If the
 * "first available quiz" heuristic fails, set E2E_QUIZ_ID to a known quiz
 * id and adapt the navigation block below.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

test.describe('Quiz offline persistence', () => {
  test.skip(
    !E2E_USER_EMAIL || !E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL / E2E_USER_PASSWORD to run quiz specs',
  );

  test('answer 2 questions offline, then sync online with no errors', async ({ page, context }) => {
    // --- Login ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await page.waitForLoadState('networkidle');

    // --- Navigate to Educação → first available quiz ---
    await page.getByRole('button', { name: /educação/i }).first().click();
    await page.waitForLoadState('networkidle');

    // Heuristic: first card/button that looks like a quiz entry point
    const quizEntry = page
      .getByRole('button', { name: /(quiz|iniciar|começar|responder)/i })
      .first();
    await expect(quizEntry).toBeVisible({ timeout: 10_000 });
    await quizEntry.click();
    await page.waitForLoadState('networkidle');

    // --- Go offline ---
    await context.setOffline(true);

    // Answer 2 questions — typical quiz UI has radio-like option buttons
    const optionButtons = page.locator('[role="radio"], button:has-text("A)"), button:has-text("B)")');
    const firstQ = optionButtons.first();
    await expect(firstQ).toBeVisible({ timeout: 5_000 });
    await firstQ.click();

    // Try to advance — "Próxima" / "Next" button if present
    const nextBtn = page.getByRole('button', { name: /(próxima|próximo|next|avançar)/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
    }
    await optionButtons.first().click();

    // --- Back online ---
    await context.setOffline(false);
    await page.waitForTimeout(2_000); // let sync attempt fire

    // Assert: no destructive error banner
    const errorBanner = page.locator('[role="alert"], .bg-destructive, [data-toast-type="error"]');
    await expect(errorBanner).toHaveCount(0);

    // Assert: previously selected option is still visually selected (persistence)
    const selectedOption = page.locator('[role="radio"][aria-checked="true"], [data-selected="true"]').first();
    await expect(selectedOption).toBeVisible({ timeout: 5_000 });
  });
});
