/**
 * Trava de LAYOUT do Balanço Hídrico Transoperatório.
 *
 * Não é regressão de conta (essa vive em `src/__tests__/lib/fluidBalance.test.js`,
 * com 53 casos). É a auditoria da reforma de 31/08/2026, cujo pedido do dono foi
 * "está confusa de usar" e "ao adicionar novo horário a tela fica muito longa".
 *
 * O que se mede aqui não dá para travar em unitário, porque é CSS e geometria:
 *
 * ⚠️ O "Balanço acumulado" gruda no topo. Isso depende de o container do
 *    `CalculatorShowcase` usar `overflow-x-clip` e NÃO `overflow-x-hidden` —
 *    com `hidden` o CSS promove `overflow-y` de `visible` para `auto`, o
 *    container vira caixa de rolagem que nunca rola (quem rola é a janela) e
 *    todo `position: sticky` descendente fica inerte. Trocar de volta some com
 *    o número da tela sem quebrar teste nenhum, e foi medido: o topo do número
 *    ia para −2.350px.
 *
 * ⚠️ A fita de horas nasce mostrando a hora ATIVA. Com 12 horas a aba em uso
 *    fica fora de vista, e quem recarrega no meio da cirurgia não acha onde
 *    digitar. A centralização é por `getBoundingClientRect`, não por
 *    `offsetLeft` — o offsetParent da fita é o BODY, e a conta por offsetLeft
 *    só acertava na última hora, por saturar no máximo.
 *
 * ⚠️ O rascunho volta depois de recarregar. Toda publicação renomeia os chunks
 *    e força recarga; sem isso, 12 horas digitadas somem no meio da cirurgia.
 *
 * Pré-req: `npm run dev` + E2E_USER_EMAIL / E2E_USER_PASSWORD no env.
 */
import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || '';
const SENHA = process.env.E2E_USER_PASSWORD || '';

const CHAVE = 'anest-bh-transop-rascunho';

/** 12 horas de uma cirurgia de 6 h, adulto 70 kg, jejum 8 h, porte grande. */
const HORAS = [
  [1000, 0, 0, 30, 60, 0], [700, 0, 0, 70, 55, 0], [600, 0, 0, 110, 45, 50],
  [600, 500, 0, 190, 40, 0], [500, 0, 0, 150, 30, 0], [500, 0, 300, 230, 25, 0],
  [450, 0, 0, 165, 22, 60], [450, 0, 0, 100, 28, 0], [400, 0, 0, 65, 34, 0],
  [400, 0, 0, 45, 38, 0], [350, 0, 0, 35, 42, 0], [350, 0, 0, 20, 45, 0],
];

async function entrar(page: Page, tema: 'light' | 'dark') {
  // Tema e rascunho ANTES do boot. Semear o rascunho evita digitar 76 campos
  // pela interface e, de quebra, é o próprio teste da persistência.
  await page.addInitScript(
    ([t, chave, horas]) => {
      localStorage.setItem('anest-theme', t as string);
      localStorage.setItem(
        chave as string,
        JSON.stringify({
          populacao: 'adulto', pedCategory: 'crianca', peso: '70', npoHoras: '8',
          porte: 'grande', hctInicial: '40', hctMinimo: '25',
          horas: (horas as number[][]).map((v, i) => ({
            id: `h${i}`, cristaloide: String(v[0]), coloide: String(v[1]),
            sangueDerivados: String(v[2]), sangramento: String(v[3]),
            diurese: String(v[4]), outras: String(v[5]),
          })),
        }),
      );
    },
    [tema, CHAVE, HORAS] as const,
  );
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000); // DeferredProviders remontam ~2s após o login
}

async function abrirCard(page: Page) {
  // ⚠️ o app NÃO tem deep link para card de calculadora (navegação por estado
  // em App.jsx): é preciso percorrer seção → card.
  await page.goto('/calculadoras');
  await page.waitForTimeout(2500);
  await page.getByText('Fluidoterapia e Sangue', { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Balanço Hídrico Transoperatório', { exact: true }).first().click();
  await expect(page.getByRole('tab', { name: /^Hora 12/ })).toBeVisible({ timeout: 10_000 });
}

test.describe('Balanço Hídrico — layout da reforma', () => {
  test.skip(!EMAIL || !SENHA, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD para rodar');

  for (const tema of ['light', 'dark'] as const) {
    test(`o resultado continua visível ao digitar a última hora — tema ${tema}`, async ({ page }) => {
      await entrar(page, tema);
      await abrirCard(page);

      // ⚠️ escopado na fita: o PillToggle Adulto/Pediátrico também é
      // `role="tab"`, então um getByRole('tab') solto conta 14.
      const fita = page.getByRole('tablist', { name: 'Horas registradas' });
      await expect(fita.getByRole('tab')).toHaveCount(12);

      // Rolar até o último campo da hora — o momento clínico real.
      await page.locator('[data-testid="hora-campos"]').scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        document.querySelector('[data-testid="hora-campos"]')?.scrollIntoView({ block: 'end' });
      });
      await page.waitForTimeout(500);

      const estado = await page.evaluate(() => {
        const card = document.querySelector('[aria-labelledby="balanco-heading"]');
        if (!card) return null;
        const r = card.getBoundingClientRect();
        return { topo: r.top, visivel: r.top >= 0 && r.top < window.innerHeight };
      });

      expect(estado, 'o card do balanço precisa existir').not.toBeNull();
      // ⚠️ se isto falhar, o primeiro suspeito é `overflow-x-hidden` ter voltado
      // ao container do CalculatorShowcase: ele mata o sticky sem erro nenhum.
      expect(estado!.visivel, 'o balanço acumulado saiu da tela ao rolar até os campos').toBe(true);
      expect(estado!.topo, 'o balanço ficou por baixo do cabeçalho fixo').toBeGreaterThanOrEqual(0);
    });
  }

  test('a fita de horas nasce mostrando a hora ativa, e centraliza qualquer hora', async ({ page }) => {
    await entrar(page, 'light');
    await abrirCard(page);

    const dentroDaFita = () =>
      page.evaluate(() => {
        const fita = document.querySelector('[role="tablist"][aria-label="Horas registradas"]');
        const ativa = fita?.querySelector('[aria-selected="true"]');
        if (!fita || !ativa) return null;
        const cf = fita.getBoundingClientRect();
        const ca = ativa.getBoundingClientRect();
        return { aba: ativa.textContent?.trim(), dentro: ca.left >= cf.left - 2 && ca.right <= cf.right + 2 };
      });

    expect(await dentroDaFita()).toMatchObject({ aba: '12', dentro: true });

    // Uma hora do MEIO: é o caso que a conta por `offsetLeft` errava.
    // Precisa rolar a fita antes — a hora 5 nasce fora de vista, que é
    // justamente o comportamento correto sendo verificado acima.
    // ⚠️ rolar só a FITA, nunca a página: o `scrollIntoViewIfNeeded` do
    // Playwright rola a janela para centralizar a aba, e ela vai parar embaixo
    // do cabeçalho fixo, do nav inferior ou do próprio card grudado — os três
    // interceptam o clique e o teste falha por motivo que não é o do produto.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const fita = document.querySelector('[role="tablist"][aria-label="Horas registradas"]');
      const alvo = fita?.querySelector('[aria-label^="Hora 5"]');
      if (fita && alvo) {
        fita.scrollLeft += alvo.getBoundingClientRect().left - fita.getBoundingClientRect().left - 8;
      }
    });
    await page.waitForTimeout(200);
    await page
      .getByRole('tablist', { name: 'Horas registradas' })
      .getByRole('tab', { name: /^Hora 5/ })
      .click();
    await page.waitForTimeout(400);
    expect(await dentroDaFita()).toMatchObject({ aba: '5', dentro: true });
  });

  test('a tela mostra 10 campos, não 76 — o resultado vem antes das entradas', async ({ page }) => {
    await entrar(page, 'light');
    await abrirCard(page);

    // 6 da hora ativa + 4 do pré-op. Antes da reforma eram 76 (12 horas × 6 + 4).
    await expect(page.locator('input[type="number"]')).toHaveCount(10);

    const ordem = await page.evaluate(() => {
      const bal = document.querySelector('[aria-labelledby="balanco-heading"]');
      const campos = document.querySelector('[data-testid="hora-campos"]');
      if (!bal || !campos) return null;
      return {
        yBalanco: bal.getBoundingClientRect().top + window.scrollY,
        yCampos: campos.getBoundingClientRect().top + window.scrollY,
      };
    });
    expect(ordem).not.toBeNull();
    expect(ordem!.yBalanco, 'o balanço tem de vir ANTES dos campos').toBeLessThan(ordem!.yCampos);
  });
});
