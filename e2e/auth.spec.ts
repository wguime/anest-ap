/**
 * E2E: Authentication flow
 *
 * Validates that a valid user can log in via the LoginPage form and reach the
 * authenticated home screen with the 4-tab bottom navigation (Home / Gestão /
 * Educação / Menu).
 *
 * Pre-req:
 *   - `npx playwright install` (one-time, ~250MB browsers)
 *   - dev server running: `npm run dev` (port 5173)
 *   - Test user credentials in env:
 *       E2E_USER_EMAIL=<seu-email-de-teste>
 *       E2E_USER_PASSWORD=<senha>
 *   - Optional: E2E_BASE_URL (defaults to http://localhost:5173)
 *
 * Run:
 *   npm run e2e -- e2e/auth.spec.ts
 *   npm run e2e -- e2e/auth.spec.ts --project=chromium
 *
 * Selectors target the LoginPage form (src/pages/LoginPage.jsx ~L240) which
 * uses `input[type=email]` and `input[type=password]`. Adjust if those change.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

test.describe('Authentication', () => {
  test.skip(
    !E2E_USER_EMAIL || !E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD env vars to run auth specs',
  );

  test('login → redirects to home with 4-tab bottom nav', async ({ page }) => {
    await page.goto('/');

    // LoginPage form
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // Wait for post-login state — Firebase Auth + Supabase JWT exchange can
    // take 2-4s on cold start.
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/$|\/home/);

    // Bottom nav has 4 tabs (App.jsx: Home, Gestão, Educação, Menu)
    for (const label of ['Home', 'Gestão', 'Educação', 'Menu']) {
      await expect(
        page.getByRole('button', { name: new RegExp(label, 'i') }).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
