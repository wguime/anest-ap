/**
 * E2E: Codificação Anestésica — calculadora de guia + consulta.
 *
 * Pré-req: dev server rodando + E2E_USER_EMAIL/E2E_USER_PASSWORD no env
 * (E2E_BASE_URL aponta pro dev; ex.: http://localhost:5174).
 *
 * Valida o fluxo da guia da imagem do usuário: angioplastia/stent pagam anestesia
 * embutida; angiografias SADT não pagam e recebem recomendação de código 31602.
 * Gera screenshots light + dark.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

async function login(page) {
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });
  // DeferredProviders montam ~2s após o login e remontam a subárvore — espera assentar
  // antes de navegar, senão o estado local da página é zerado no meio da interação.
  await page.waitForTimeout(3000);
}

test.describe('Codificação Anestésica', () => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');

  test('calcula a guia da imagem, recomenda código e gera screenshots', async ({ page }) => {
    test.setTimeout(90_000); // login + settles dos providers + 2 buscas server-backed
    await login(page);

    await page.goto('/codificacao-anestesica');
    await expect(page.getByRole('heading', { name: 'Codificação Anestésica' })).toBeVisible({ timeout: 15_000 });
    // deixa o remount diferido (providers) ocorrer uma vez e estabilizar antes de interagir
    await page.waitForTimeout(4000);

    const buscar = page.getByPlaceholder(/Digite o código ou nome/i);

    // helper: digita e escolhe a sugestão pelo código (keystrokes reais p/ disparar o debounce)
    const adicionar = async (codigo: string) => {
      await buscar.click();
      await buscar.pressSequentially(codigo, { delay: 30 });
      const opcao = page.getByRole('button', { name: new RegExp(codigo) });
      await opcao.first().waitFor({ state: 'visible', timeout: 15_000 });
      await opcao.first().click();
    };

    // Busca por NOME (acento-insensível) mostra sugestões no mesmo campo
    await buscar.click();
    await buscar.pressSequentially('glandula lacrimal', { delay: 25 });
    await expect(page.getByRole('button', { name: /gl[âa]ndula lacrimal/i }).first()).toBeVisible({ timeout: 15_000 });
    await buscar.clear();

    // Angioplastia (paga anestesia embutida) — valor em UTM 1,73 (819×1,73/1,17 = 1.211)
    await adicionar('40813185');
    await expect(page.getByText('Anestesia paga').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('R$ 1.211,00').first()).toBeVisible();
    await expect(page.getByText('UTM R$ 1,73').first()).toBeVisible();

    // badge de % abre dropdown com as opções dos documentos (Principal/vias de acesso)
    await page.getByRole('button', { name: /Percentual do procedimento/ }).first().click();
    await expect(page.getByText('Mesma via de acesso')).toBeVisible();
    await expect(page.getByText('Outra via de acesso')).toBeVisible();
    await page.keyboard.press('Escape');

    // Angiografia SADT (não paga → recomenda código)
    await adicionar('40812049');
    await expect(page.getByText('Adicionar código').first()).toBeVisible();
    await expect(page.getByText(/3160(2258|2355|2347)/).first()).toBeVisible();

    await page.screenshot({ path: 'e2e/__screenshots__/codificacao-light.png', fullPage: true });

    // Limpa e testa porte 0 (exérese de pele) → recomenda 31602355
    await page.getByRole('button', { name: /limpar/i }).click();
    await expect(page.getByText('Nenhum código adicionado')).toBeVisible();
    await adicionar('30101921');
    await expect(page.getByText('Adicionar código').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('31602355').first()).toBeVisible();

    // Dark mode
    await page.evaluate(() => localStorage.setItem('anest-theme', 'dark'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Codificação Anestésica' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'e2e/__screenshots__/codificacao-dark.png', fullPage: true });

    // Aba Consulta: referência curada (accordion) visível com vazio
    await page.getByRole('tab', { name: /consulta/i }).click();
    await expect(page.getByText('31602355').first()).toBeVisible({ timeout: 10_000 });

    // accordion: clicar abre explicação + exemplos
    await page.getByRole('button', { name: /31602355/ }).first().click();
    await expect(page.getByText('Quando usar', { exact: true })).toBeVisible();
    await expect(page.getByText('Exemplos', { exact: true })).toBeVisible();
    await expect(page.getByText(/Indicador anest[ée]sico:/).first()).toBeVisible();

    // busca por NOME de procedimento sem valor de anestesia → mostra substituto + justificativa
    const buscaConsulta = page.getByPlaceholder(/Buscar procedimento por código ou nome/i);
    await buscaConsulta.click();
    await buscaConsulta.pressSequentially('exerese de unha', { delay: 25 });
    await page.getByRole('button', { name: /30101484/ }).first().click({ timeout: 15_000 });
    await expect(page.getByText('Para a anestesia ser paga, registre o código:')).toBeVisible();
    await expect(page.getByText('Justificativa', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/codificacao-consulta.png', fullPage: true });
  });
});
