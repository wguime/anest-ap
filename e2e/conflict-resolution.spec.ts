/**
 * E2E: Admin conflict resolution flow
 *
 * Validates that an admin can resolve a sync conflict from Centro de Gestão:
 *   1. Login as admin
 *   2. Navigate to Centro de Gestão → Conflitos tab
 *   3. Click "Resolver" on the first conflict row
 *   4. Modal opens
 *   5. Click "Aplicar minha versão" → success toast appears
 *
 * Pre-req:
 *   - `npx playwright install` (one-time)
 *   - dev server running: `npm run dev`
 *   - Admin user credentials:
 *       E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *   - At least one open conflict in the conflicts table. To seed one for
 *     testing, manually create a divergent edit on the same document from
 *     two sessions (or use a fixture/seed script if available).
 *
 * Run:
 *   npm run e2e -- e2e/conflict-resolution.spec.ts
 *
 * Falls back gracefully (test.skip) when no conflicts are present.
 */
import { test, expect } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.E2E_USER_EMAIL || '';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD || '';

test.describe('Conflict resolution (admin)', () => {
  test.skip(
    !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD,
    'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run conflict specs',
  );

  test('admin resolves conflict via "Aplicar minha versão"', async ({ page }) => {
    // --- Login ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await page.waitForLoadState('networkidle');

    // --- Centro de Gestão ---
    await page.getByRole('button', { name: /gestão/i }).first().click();
    await page.waitForLoadState('networkidle');

    // Centro de Gestão card / link
    const cgEntry = page.getByRole('button', { name: /centro de gestão/i }).first();
    if (await cgEntry.isVisible().catch(() => false)) {
      await cgEntry.click();
      await page.waitForLoadState('networkidle');
    }

    // --- Conflitos tab ---
    const conflitosTab = page.getByRole('tab', { name: /conflitos/i })
      .or(page.getByRole('button', { name: /conflitos/i }))
      .first();
    await expect(conflitosTab).toBeVisible({ timeout: 10_000 });
    await conflitosTab.click();
    await page.waitForLoadState('networkidle');

    // --- Find a conflict row & resolve ---
    const resolverBtn = page.getByRole('button', { name: /resolver/i }).first();
    const hasConflict = await resolverBtn.isVisible().catch(() => false);
    test.skip(!hasConflict, 'No open conflicts to resolve — seed one first');

    await resolverBtn.click();

    // Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Apply own version
    await modal.getByRole('button', { name: /aplicar minha versão|aplicar minha/i }).first().click();

    // Success toast
    const toast = page.locator('[role="status"], [data-toast-type="success"], .toast-success').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });
});
