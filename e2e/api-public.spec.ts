/**
 * E2E: Public API token lifecycle
 *
 * Validates the full lifecycle of an API token from admin UI:
 *   1. Login as admin
 *   2. Navigate to Centro de Gestão → API Tokens
 *   3. Generate a new token with all 3 scopes
 *   4. Capture the token (shown ONCE at creation)
 *   5. Use page.request to call /v1/docs with Authorization: Bearer <token>
 *      → expect 200 + body shape
 *   6. Revoke the token via UI
 *   7. Re-call /v1/docs → expect 401
 *
 * Pre-req:
 *   - `npx playwright install` (one-time)
 *   - dev server running: `npm run dev`
 *   - Admin user with API token management permission:
 *       E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *   - API base URL: E2E_API_BASE (default: same origin as the app)
 *
 * DEPENDS ON: branch `feat/fech-ui-scopes` (Wave 2.1) which adds the
 * 3-scope checkboxes to the API Tokens UI. If that branch is not merged,
 * this spec will skip on the scope selection step.
 *
 * Run:
 *   npm run e2e -- e2e/api-public.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.E2E_USER_EMAIL || '';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD || '';
const E2E_API_BASE = process.env.E2E_API_BASE || process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Public API tokens', () => {
  test.skip(
    !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD,
    'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run API specs',
  );

  test('generate token → 200 on /v1/docs → revoke → 401', async ({ page }) => {
    // --- Login ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await page.waitForLoadState('networkidle');

    // --- Centro de Gestão → API Tokens tab ---
    await page.getByRole('button', { name: /gestão/i }).first().click();
    await page.waitForLoadState('networkidle');

    const cgEntry = page.getByRole('button', { name: /centro de gestão/i }).first();
    if (await cgEntry.isVisible().catch(() => false)) {
      await cgEntry.click();
      await page.waitForLoadState('networkidle');
    }

    const apiTab = page.getByRole('tab', { name: /api( tokens)?/i })
      .or(page.getByRole('button', { name: /api( tokens)?/i }))
      .first();
    await expect(apiTab).toBeVisible({ timeout: 10_000 });
    await apiTab.click();

    // --- Generate token ---
    await page.getByRole('button', { name: /(gerar|novo|criar).*token/i }).first().click();

    // Modal: select all 3 scopes (Wave 2.1 UI)
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    const scopeBoxes = modal.locator('input[type="checkbox"][name*="scope"], [role="checkbox"][data-scope]');
    const scopeCount = await scopeBoxes.count();
    test.skip(scopeCount < 3, 'Scope selector not present — requires feat/fech-ui-scopes (Wave 2.1)');

    for (let i = 0; i < 3; i++) {
      await scopeBoxes.nth(i).check().catch(async () => {
        await scopeBoxes.nth(i).click();
      });
    }

    // Optional token name
    const nameInput = modal.locator('input[name*="name"], input[placeholder*="nome" i]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('e2e-token-' + Date.now());
    }

    await modal.getByRole('button', { name: /(gerar|criar|confirmar)/i }).first().click();

    // --- Capture token (shown once) ---
    const tokenField = page.locator('input[readonly], code, [data-testid="generated-token"]').first();
    await expect(tokenField).toBeVisible({ timeout: 5_000 });
    const token = (await tokenField.inputValue().catch(() => null)) || (await tokenField.textContent()) || '';
    expect(token.length).toBeGreaterThan(20);

    // --- Call /v1/docs → 200 ---
    const ok = await page.request.get(`${E2E_API_BASE}/v1/docs`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data) || typeof body.data === 'object').toBe(true);

    // --- Close generated-token modal if any, then revoke ---
    const closeBtn = page.getByRole('button', { name: /(fechar|ok|continuar)/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }

    const revokeBtn = page.getByRole('button', { name: /(revogar|excluir|deletar)/i }).first();
    await expect(revokeBtn).toBeVisible({ timeout: 5_000 });
    await revokeBtn.click();

    // Confirm dialog
    const confirmBtn = page.getByRole('button', { name: /(confirmar|sim|revogar)/i }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    // --- Re-call /v1/docs → 401 ---
    await page.waitForTimeout(1_000); // let revocation propagate
    const unauthorized = await page.request.get(`${E2E_API_BASE}/v1/docs`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    expect([401, 403]).toContain(unauthorized.status());
  });
});
