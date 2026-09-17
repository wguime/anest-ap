/**
 * E2E: o DS é o MESMO em todo aparelho (16/09/2026).
 *
 * Roda nos dois projetos (chromium = Android/desktop; mobile = WebKit "iPhone 14")
 * e confere o que antes divergia entre plataformas:
 *  - barra inferior: fundo por token, alpha 0,97, SEM backdrop-filter (antes só o
 *    iOS era assim; Android/desktop levavam blur + saturate e a cor variava);
 *  - <html> com color-scheme `only light` no claro e `dark` no escuro (opt-out
 *    do escuro forçado do Chrome Android / Samsung Internet);
 *  - <meta name="theme-color"> = fundo da página do tema (moldura do Android e
 *    do Safari 15+), e verde institucional enquanto o login está na tela.
 *
 * Pre-req: `npm run dev` + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/tema-plataforma.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

// = THEME_COLOR de src/design-system/hooks/useTheme.jsx (fundo que --background renderiza)
const FUNDO = { light: '#F0FFF4', dark: '#111815' } as const;
// = hsl(var(--muted) / 0.97) claro e hsl(var(--background) / 0.97) escuro
const BARRA = { light: 'rgba(232, 248, 236, 0.97)', dark: 'rgba(17, 24, 21, 0.97)' } as const;

test.use({ viewport: { width: 390, height: 844 } });

for (const theme of ['light', 'dark'] as const) {
  test(`barra inferior, color-scheme e theme-color — ${theme}`, async ({ page }) => {
    test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
    test.setTimeout(90_000);

    await page.addInitScript((t) => localStorage.setItem('anest-theme', t), theme);
    await page.goto('/');

    // Login na tela: moldura verde institucional, seja qual for o tema
    await expect(page.locator('input[autocomplete="email"]').first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#006837');

    await page.locator('input[autocomplete="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

    // Moldura = fundo da página do tema; esquema declarado ao navegador
    await expect.poll(() => page.locator('meta[name="theme-color"]').getAttribute('content')).toBe(FUNDO[theme]);
    await expect.poll(() => page.locator('meta[name="color-scheme"]').getAttribute('content'))
      .toBe(theme === 'light' ? 'only light' : 'dark');
    // O valor COMPUTADO prova que o motor entendeu o `only` (Chromium e WebKit
    // serializam como "light only"; a ordem não importa).
    const colorScheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    if (theme === 'light') expect(colorScheme.split(' ').sort()).toEqual(['light', 'only']);
    else expect(colorScheme).toBe('dark');

    // Barra inferior: uma regra para todo motor
    const nav = page.locator('nav.bottom-nav-glass').first();
    await expect(nav).toBeVisible();
    const estilo = await nav.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        filtro: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none',
      };
    });
    expect(estilo.bg).toBe(BARRA[theme]);
    expect(estilo.filtro).toBe('none');
  });
}
