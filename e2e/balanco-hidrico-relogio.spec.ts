/**
 * Relógio do procedimento no Balanço Hídrico Transoperatório.
 *
 * Pedido do dono (02/09/2026): "adicionar data e horário de início de
 * procedimento e que acompanhem as horas de procedimento". A série era
 * "Hora 1, 2, 3…" — números sem relógio; agora cada bloco de 1 h cai no
 * horário real da sala e o card conta o tempo corrido.
 *
 * A ARITMÉTICA do relógio está travada em unitário
 * (`src/__tests__/lib/tempoProcedimento.test.js`, 21 casos). O que só se vê no
 * navegador, e é o que este arquivo mede:
 *
 * ⚠️ O relógio aparece DENTRO da aba, embaixo do número — sem estourar os 44px
 *    de alvo de toque nem espremer a fita, que rola na horizontal a 375px.
 *
 * ⚠️ O aviso de virada só existe quando o relógio passou do fim da última hora
 *    lançada. Ele é um CONVITE de um toque: nenhuma hora nasce sozinha, porque
 *    hora em branco entra na conta como medida (`rate * horas.length` em
 *    `evaluateBalance`) e inventaria manutenção e terceiro espaço.
 *
 * Pré-req: `npm run dev` + E2E_USER_EMAIL / E2E_USER_PASSWORD no env.
 */
import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || '';
const SENHA = process.env.E2E_USER_PASSWORD || '';

const CHAVE = 'anest-bh-transop-rascunho';

/** Rascunho de N horas começando `horasAtras` horas antes de agora. */
function rascunho(n: number, horasAtras: number) {
  const inicio = new Date(Date.now() - horasAtras * 3600000);
  const dois = (v: number) => String(v).padStart(2, '0');
  return {
    populacao: 'adulto', pedCategory: 'crianca', peso: '70', npoHoras: '8',
    porte: 'grande', hctInicial: '40', hctMinimo: '25',
    inicioData: `${inicio.getFullYear()}-${dois(inicio.getMonth() + 1)}-${dois(inicio.getDate())}`,
    inicioHora: `${dois(inicio.getHours())}:${dois(inicio.getMinutes())}`,
    horas: Array.from({ length: n }, (_, i) => ({
      id: `h${i}`, cristaloide: '500', coloide: '', sangueDerivados: '',
      sangramento: '50', diurese: '45', outras: '',
    })),
  };
}

async function entrar(page: Page, tema: 'light' | 'dark', draft: object) {
  await page.addInitScript(
    ([t, chave, d]) => {
      localStorage.setItem('anest-theme', t as string);
      localStorage.setItem(chave as string, JSON.stringify(d));
    },
    [tema, CHAVE, draft] as const,
  );
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000); // DeferredProviders remontam ~2s após o login
}

async function abrirCard(page: Page) {
  // Sem deep link para card de calculadora: navegação por estado em App.jsx.
  await page.goto('/calculadoras');
  await page.waitForTimeout(2500);
  await page.getByText('Fluidoterapia e Sangue', { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Balanço Hídrico Transoperatório', { exact: true }).first().click();
  await expect(page.getByRole('tablist', { name: 'Horas registradas' })).toBeVisible({ timeout: 10_000 });
}

test.describe('Balanço Hídrico — relógio do procedimento', () => {
  test.skip(!EMAIL || !SENHA, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD para rodar');

  for (const tema of ['light', 'dark'] as const) {
    test(`a hora carrega o relógio da sala sem perder o número — tema ${tema}`, async ({ page }) => {
      // 6 horas lançadas para uma cirurgia de 6 h: o relógio está DENTRO da
      // última hora, então não há virada pendente.
      await entrar(page, tema, rascunho(6, 5.5));
      await abrirCard(page);

      const fita = page.getByRole('tablist', { name: 'Horas registradas' });
      await expect(fita.getByRole('tab')).toHaveCount(6);

      // O aria-label leva número E faixa: é o que o leitor de tela anuncia.
      await expect(fita.getByRole('tab', { name: /^Hora 3, \d{2}:\d{2}–\d{2}:\d{2}$/ })).toBeVisible();

      const abas = await page.evaluate(() => {
        const f = document.querySelector('[role="tablist"][aria-label="Horas registradas"]');
        return [...(f?.querySelectorAll('[role="tab"]') ?? [])].map((el) => {
          const r = el.getBoundingClientRect();
          const linhas = [...el.querySelectorAll('span')].map((s) => s.textContent?.trim());
          return { w: r.width, h: r.height, linhas };
        });
      });

      // O número continua na aba (é o que os alertas citam: "anúria na hora 3")
      // e o relógio entrou embaixo dele.
      expect(abas[2].linhas).toContain('3');
      expect(abas.some((a) => a.linhas.some((l) => /^\d{2}:\d{2}$/.test(l ?? '')))).toBe(true);
      for (const a of abas) {
        expect(a.w, 'aba abaixo do alvo de toque de 44px').toBeGreaterThanOrEqual(44);
        expect(a.h, 'aba abaixo do alvo de toque de 44px').toBeGreaterThanOrEqual(44);
      }

      // A faixa do início mostra data, hora e tempo corrido.
      await expect(page.getByText(/de procedimento$/)).toBeVisible();

      /* ⚠️ Os dois campos nascem FECHADOS — a faixa é fina de propósito, e é
         ela que fica à vista durante a cirurgia. Já falhou: com `hidden` num
         elemento que também é `grid`, a utility vence a regra do atributo (mesma
         especificidade, vem depois) e o formulário ficava aberto o tempo todo. */
      await expect(page.locator('#inicio-campos')).toHaveCount(0);
      await page.getByRole('button', { name: /alterar/i }).last().click();
      await expect(page.locator('#inicio-campos input[type="time"]')).toBeVisible();
      await page.getByRole('button', { name: /ocultar/i }).last().click();
      await expect(page.locator('#inicio-campos')).toHaveCount(0);

      // Nada a avisar: o relógio ainda está na última hora lançada.
      await expect(page.getByRole('button', { name: /^Já são/ })).toHaveCount(0);

      // O livro-razão também é hora a hora: h1 ganha o relógio embaixo.
      await page.getByRole('button', { name: /ver as 6 horas/i }).click();
      // O cabeçalho do livro é o sinal de que ele abriu — a célula da hora não
      // serve como espera: o texto dela é justamente o que está sob teste.
      await expect(page.getByText('saldo', { exact: true })).toBeVisible();
      const linhaLivro = await page.locator('[data-testid="livro-hora"]').first().innerText();
      expect(linhaLivro.replace(/\s+/g, ' '), 'o livro-razão perdeu o relógio da hora')
        .toMatch(/^h1 \d{2}:\d{2}$/);
      await page.getByRole('button', { name: /ocultar as horas/i }).click();

      await page
        .locator('[aria-label="Hora a hora"]')
        .screenshot({ path: `e2e/__screenshots__/bh-relogio-${tema}.png` });
    });
  }

  test('o relógio passou da última hora: avisa e abre a próxima com um toque', async ({ page }) => {
    // 1 hora lançada, procedimento correndo há 3 h: faltam horas a lançar.
    await entrar(page, 'light', rascunho(1, 3));
    await abrirCard(page);

    const fita = page.getByRole('tablist', { name: 'Horas registradas' });
    await expect(fita.getByRole('tab')).toHaveCount(1);

    const aviso = page.getByRole('button', { name: /^Já são \d{2}:\d{2}\. Abrir a hora 2$/ });
    await expect(aviso).toBeVisible();
    await aviso.click();

    await expect(fita.getByRole('tab')).toHaveCount(2);
    // A hora 2 nasce ABERTA para digitar, e o aviso continua — o relógio está
    // na 4ª hora, ainda há atraso a recuperar.
    await expect(page.getByRole('button', { name: /^Já são \d{2}:\d{2}\. Abrir a hora 3$/ })).toBeVisible();

    await page
      .locator('[aria-label="Hora a hora"]')
      .screenshot({ path: 'e2e/__screenshots__/bh-relogio-virada.png' });
  });

  test('sem início informado a fita continua sendo só o número', async ({ page }) => {
    // Rascunho anterior à mudança: quem já tinha uma cirurgia em andamento não
    // pode ver a tela se reorganizar sozinha no meio do caso.
    const antigo = { ...rascunho(3, 2), inicioData: '', inicioHora: '' };
    await entrar(page, 'light', antigo);
    await abrirCard(page);

    const fita = page.getByRole('tablist', { name: 'Horas registradas' });
    await expect(fita.getByRole('tab', { name: 'Hora 2' })).toBeVisible();
    await expect(page.getByText('Início não informado')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Já são/ })).toHaveCount(0);
  });
});

/* O widget nativo de data escreve no formato do SISTEMA: no iPhone em pt-BR
   isso é "2 de set. de 2026", quase o dobro do "02/09/2026" que o WebKit
   headless mostra. Ele não encolhe — a largura intrínseca do widget empurra o
   item de grid, que nasce com `min-width:auto` — e a caixa da data vazava por
   baixo da caixa da hora (foto do dono, 02/09/2026). */
test.describe('Balanço Hídrico — os campos de início não vazam da caixa', () => {
  test.skip(!EMAIL || !SENHA, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD para rodar');
  test.use({ locale: 'pt-BR' });

  test('mesmo com o texto do widget no pior caso, nada ultrapassa a borda', async ({ page }) => {
    await entrar(page, 'light', rascunho(5, 5));
    await abrirCard(page);
    await page.getByRole('button', { name: /alterar/i }).last().click();
    await expect(page.locator('#inicio-campos input[type="time"]')).toBeVisible();

    /* Inflar a fonte reproduz a pressão do formato longo do iOS, que o browser
       do teste não escreve. Sem `min-w-0` nos dois níveis (item de grid e
       control do DS) a caixa estoura aqui. */
    await page.addStyleTag({ content: '#inicio-campos input { font-size: 26px !important; }' });
    await page.waitForTimeout(300);

    const m = await page.evaluate(() => {
      const box = document.querySelector('#inicio-campos');
      const r = box.getBoundingClientRect();
      const controls = [...box.querySelectorAll('[data-slot="input-control"]')].map((c) => {
        const rc = c.getBoundingClientRect();
        return { left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom };
      });
      return { caixa: { left: r.left, right: r.right }, controls };
    });

    expect(m.controls).toHaveLength(2);
    for (const c of m.controls) {
      expect(c.right, 'o campo vazou pela direita da caixa').toBeLessThanOrEqual(m.caixa.right + 1);
      expect(c.left, 'o campo vazou pela esquerda da caixa').toBeGreaterThanOrEqual(m.caixa.left - 1);
    }

    // Empilhados a 390px: se um dia voltarem a dividir a linha, é porque coube
    // — mas então não podem se sobrepor.
    const [data, hora] = m.controls;
    const mesmaLinha = data.top < hora.bottom && hora.top < data.bottom;
    if (mesmaLinha) {
      expect(data.right, 'a caixa da data passou por baixo da caixa da hora').toBeLessThanOrEqual(hora.left + 1);
    }
  });
});
