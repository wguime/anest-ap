/**
 * E2E: Critérios UTI deixaram o Menu e viraram seção em Calculadoras.
 *
 * Decisão do dono (29/08/2026). Este spec trava as três metades da mudança,
 * porque nenhuma delas aparece em teste unitário:
 *
 *   1. O card "Critérios UTI" NÃO está mais no Menu.
 *   2. A seção "Indicação de UTI" existe em Calculadoras, com as 5 ferramentas
 *      validadas para decidir encaminhamento perioperatório à UTI — e SEM as
 *      duas que saíram (POTTER-Inspirado e P-POSSUM).
 *   3. Abrir uma delas renderiza a tela de detalhe reaproveitada da
 *      `CriteriosUTIPage` (import lazy + Suspense local).
 *
 * ⚠️ A rota `criteriosUti` continua respondendo mesmo sem card — link salvo e
 * histórico do navegador não podem quebrar. Também está coberto aqui.
 *
 * Pré-req: dev server rodando + E2E_USER_EMAIL / E2E_USER_PASSWORD.
 * Run: npm run e2e -- e2e/criterios-uti-secao.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

async function login(page) {
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  // NÃO usar networkidle: a home mantém websockets abertos e a rede nunca acalma.
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({
    timeout: 20_000,
  });
}

async function abrirCalculadoras(page) {
  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
  await bottomNav.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Calculadoras/i }).first().click();
  await expect(page.getByRole('button', { name: /Indicação de UTI/i })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('Critérios UTI dentro de Calculadoras', () => {
  test.skip(
    !E2E_USER_EMAIL || !E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL / E2E_USER_PASSWORD to run this spec',
  );

  test('o card sumiu do Menu e a seção existe em Calculadoras', async ({ page }) => {
    await login(page);

    const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
    await bottomNav.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible({ timeout: 10_000 });

    // 1. O card saiu do Menu.
    await expect(page.getByRole('button', { name: /Critérios UTI/i })).toHaveCount(0);

    // 2. A seção existe em Calculadoras.
    await page.getByRole('button', { name: /Calculadoras/i }).first().click();
    const cabecalho = page.getByRole('button', { name: /Indicação de UTI/i });
    await expect(cabecalho).toBeVisible({ timeout: 10_000 });
  });

  test('a seção traz as 5 validadas e nenhuma das 2 que saíram', async ({ page }) => {
    await login(page);
    await abrirCalculadoras(page);
    await page.getByRole('button', { name: /Indicação de UTI/i }).click();

    for (const nome of ['SORT', 'ESS', 'SAS', 'SIAARTI 2025', 'CFM 2156']) {
      await expect(
        page.getByRole('button', { name: new RegExp(nome, 'i') }).first(),
        `${nome} deveria estar na seção`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // As duas cortadas por falta de validação para ESTA decisão.
    await expect(page.getByRole('button', { name: /POTTER/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /POSSUM/i })).toHaveCount(0);
  });

  test('abrir uma ferramenta renderiza a tela de detalhe (lazy + Suspense)', async ({ page }) => {
    await login(page);
    await abrirCalculadoras(page);
    await page.getByRole('button', { name: /Indicação de UTI/i }).click();
    await page.getByRole('button', { name: /SORT/i }).first().click();

    // O detalhe vem de CriteriosUTIPage.CalculatorDetailPage, carregado sob
    // demanda. Se o Suspense local faltasse, a tela anterior congelaria sem erro.
    await expect(page.getByText(/Surgical Outcome Risk Tool|SORT/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Carregando/i)).toHaveCount(0);
  });

  test('a rota criteriosUti continua respondendo sem o card', async ({ page }) => {
    await login(page);
    // Link salvo e histórico do navegador não podem quebrar só porque o card saiu.
    await page.goto('/criterios-uti');
    await expect(page.getByText(/POTTER/i)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Página não encontrada');
  });
});
