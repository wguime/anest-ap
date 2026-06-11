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

// IMPORTANTE: sem fallback para E2E_USER_* — o fluxo exige um ADMIN real
// (Centro de Gestão → aba Conflitos é admin-gated). Rodar com o user e2e
// comum falha no gate de permissão, não no que o teste valida. Enquanto não
// existir credencial admin de teste, este spec fica skipped (documentado).
const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';

test.describe('Conflict resolution (admin)', () => {
  test.skip(
    !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD,
    'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (admin real, sem fallback para user comum) to run conflict specs',
  );

  test('admin resolves conflict via "Aplicar minha versão"', async ({ page }) => {
    // --- Login ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // NÃO usar waitForLoadState('networkidle'): a home mantém conexões
    // realtime abertas e a rede nunca fica idle. Esperar elemento concreto.
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({
      timeout: 20_000,
    });

    // --- Centro de Gestão ---
    const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
    await bottomNav.getByRole('button', { name: 'Gestão' }).click();

    // Centro de Gestão card / link
    const cgEntry = page.getByRole('button', { name: /centro de gestão/i }).first();
    const hasCgEntry = await cgEntry
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (hasCgEntry) {
      await cgEntry.click();
    }

    // --- Conflitos tab ---
    const conflitosTab = page.getByRole('tab', { name: /conflitos/i })
      .or(page.getByRole('button', { name: /conflitos/i }))
      .first();
    await expect(conflitosTab).toBeVisible({ timeout: 10_000 });
    await conflitosTab.click();

    // Espera o conteúdo da aba renderizar (header do ConflictsTab) antes de
    // procurar a linha de conflito — sem isso o isVisible() imediato abaixo
    // pode rodar antes do fetch e dar skip falso.
    await expect(page.getByRole('heading', { name: 'Conflitos offline' })).toBeVisible({
      timeout: 10_000,
    });

    // --- Find a conflict row & resolve ---
    const resolverBtn = page.getByRole('button', { name: /resolver/i }).first();
    const hasConflict = await resolverBtn
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasConflict, 'No open conflicts to resolve — seed one first');

    await resolverBtn.click();

    // Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Apply own version
    await modal.getByRole('button', { name: /aplicar minha versão|aplicar minha/i }).first().click();

    // Success toast (Sonner — ver src/design-system/components/ui/toast.jsx)
    const toast = page.locator('[data-sonner-toast][data-type="success"]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });
});
