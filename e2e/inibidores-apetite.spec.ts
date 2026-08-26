/**
 * Verificação de DS do card "Inibidores de apetite".
 *
 * Não é regressão de negócio — é a auditoria de layout que o dono pediu no
 * card de Anticoagulantes e que pegou, lá, quatro defeitos reais: barra de
 * abas mais estreita que os cards, rótulo truncado, alvo de toque abaixo de
 * 44px e card cortado por ancestral com overflow-hidden.
 *
 * Pré-req: `npm run dev` + E2E_USER_EMAIL / E2E_USER_PASSWORD no env.
 */
import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || '';
const SENHA = process.env.E2E_USER_PASSWORD || '';

async function entrar(page: Page, tema: 'light' | 'dark') {
  // O tema precisa estar no localStorage ANTES do boot: forçar a classe .dark
  // no <html> depois não muda TabsList/TabsTrigger, que leem useTheme() do
  // contexto — foi assim que uma rodada de screenshots "dark" saiu falsa.
  await page.addInitScript((t) => localStorage.setItem('anest-theme', t), tema);
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000); // DeferredProviders remontam ~2s após o login
}

async function abrirCard(page: Page) {
  await page.goto('/calculadoras');
  await page.waitForTimeout(2500);
  await page.getByText('Perioperatório e Via Aérea', { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Inibidores de apetite', { exact: true }).first().click();
  await expect(page.getByRole('tab', { name: 'Pré-op' })).toBeVisible({ timeout: 10_000 });
}

/** Geometria: barra de abas × cards, truncamento, alvo de toque, estouro. */
async function auditar(page: Page, rotulo: string) {
  return page.evaluate((ctx) => {
    const lista = document.querySelector('[role="tablist"]') as HTMLElement | null;
    const abas = Array.from(document.querySelectorAll('[role="tab"]')) as HTMLElement[];
    const cards = Array.from(document.querySelectorAll('[data-slot="card"], .rounded-\\[20px\\]')) as HTMLElement[];

    const r = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) };
    };

    // truncamento real: conteúdo mais largo que a caixa
    // sr-only é recortado DE PROPÓSITO (o skip-link do app mede 1px e usa
    // clip) — contá-lo como truncamento é falso-positivo.
    const invisivelPorDesign = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      if (b.width <= 1 || b.height <= 1) return true;
      const cs = getComputedStyle(el);
      return cs.clip !== 'auto' || cs.clipPath.includes('inset(50%)') || cs.position === 'absolute' && cs.overflow === 'hidden' && b.width <= 1;
    };

    const truncados: string[] = [];
    document.querySelectorAll('*').forEach((n) => {
      const el = n as HTMLElement;
      if (!el.offsetParent || el.children.length > 0) return;
      if (invisivelPorDesign(el)) return;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        truncados.push((el.textContent || '').trim().slice(0, 48));
      }
    });

    /* Alvos de toque abaixo de 44px.
     *
     * Duas correções de medição, ambas verificadas comparando com o card de
     * Anticoagulantes, que já está em produção e mede exatamente igual:
     *
     * 1. No Input do DS o <input> tem 24px, mas quem recebe o toque é a CAIXA
     *    do campo, de 58px. Medir o elemento interno acusa falso-positivo.
     * 2. O botão "Voltar" de 20px é o do CABEÇALHO da página de calculadora,
     *    compartilhado pelas 70 — não é deste card. Fica na lista de
     *    conhecidos: mexer nele é mudança visual em 70 telas e depende de
     *    pedido do dono (Regra #2). */
    const CONHECIDOS_DO_APP = ['Voltar'];
    const pequenos: string[] = [];
    document.querySelectorAll('button, a, [role="tab"], input').forEach((n) => {
      const el = n as HTMLElement;
      const b = el.getBoundingClientRect();
      if (b.width <= 1 || b.height <= 1) return;
      const rotulo = (el.textContent || el.getAttribute('aria-label') || '?').trim();
      if (CONHECIDOS_DO_APP.includes(rotulo)) return;
      const paiH = el.parentElement?.getBoundingClientRect().height ?? 0;
      const efetiva = el.tagName === 'INPUT' ? Math.max(b.height, paiH) : b.height;
      if (efetiva < 44) pequenos.push(`${rotulo.slice(0, 28)} (${Math.round(efetiva)}px)`);
    });

    const larguraCards = cards.filter((c) => r(c).w > 200).map((c) => r(c).w);

    return {
      contexto: ctx,
      lista: lista ? r(lista) : null,
      abas: abas.map((a) => ({ txt: a.textContent?.trim(), ...r(a) })),
      larguraCardMaisComum: larguraCards.sort((a, b) => larguraCards.filter(x => x === b).length - larguraCards.filter(x => x === a).length)[0] ?? null,
      estouroHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      truncados: [...new Set(truncados)],
      alvosPequenos: [...new Set(pequenos)],
    };
  }, rotulo);
}

test.describe('Inibidores de apetite — DS', () => {
  test.skip(!EMAIL || !SENHA, 'Defina E2E_USER_EMAIL / E2E_USER_PASSWORD');

  for (const tema of ['light', 'dark'] as const) {
    test(`layout e abas a 375px — tema ${tema}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 375, height: 812 });
      await entrar(page, tema);
      await abrirCard(page);

      const abas = ['Pré-op', 'No dia', 'Referência'];
      for (const aba of abas) {
        await page.getByRole('tab', { name: aba }).click();
        await page.waitForTimeout(600);
        const a = await auditar(page, `${tema}/${aba}`);
        console.log(JSON.stringify(a, null, 1));

        // a barra de abas tem de ter a MESMA largura dos cards (defeito de 25/08)
        if (a.lista && a.larguraCardMaisComum) {
          expect(Math.abs(a.lista.w - a.larguraCardMaisComum), `barra × card em ${aba}`).toBeLessThanOrEqual(2);
        }
        // as quatro pastilhas têm de ser iguais
        const larguras = a.abas.map((x) => x.w);
        expect(Math.max(...larguras) - Math.min(...larguras), `abas desiguais em ${aba}`).toBeLessThanOrEqual(1);
        expect(a.estouroHorizontal, `estouro horizontal em ${aba}`).toBe(false);
        expect(a.truncados, `texto truncado em ${aba}`).toEqual([]);
        expect(a.alvosPequenos, `alvo de toque < 44px em ${aba}`).toEqual([]);

        await page.screenshot({ path: `e2e/__screenshots__/inibidores-${tema}-${aba.toLowerCase().replace(/[^a-z]/g,'')}.png`, fullPage: true });
      }
    });
  }

  test('a avaliação do paciente muda a conduta e o painel aparece inteiro', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');
    await abrirCard(page);

    await page.getByText('Liraglutida', { exact: true }).first().click();
    await expect(page.getByText('1 dia antes').first()).toBeVisible();

    // o norte da suspensão é a SBA (pedido do dono, 25/08) e a tela tem de
    // dizer isso — inclusive quando o fármaco fica FORA da nota dela
    await expect(page.getByText('Itens 4 e 5 da nota', { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: /Avaliação do paciente/ }).click();
    await page.waitForTimeout(500);

    // a folha não pode nascer com 85% da tela quase vazia (h-[85vh] do DS)
    const folha = page.locator('[data-slot="sheet-content"]');
    const alturaFolha = (await folha.boundingBox())?.height ?? 0;
    console.log('altura da folha:', alturaFolha);

    // marcar UM fator sobe para alto risco e leva o piso a 7 dias
    await page.getByText('Sintomas gastrointestinais', { exact: true }).first().click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Alto risco/).first()).toBeVisible();

    await page.screenshot({ path: 'e2e/__screenshots__/inibidores-avaliacao.png', fullPage: true });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.getByText('No mínimo 7 dias').first()).toBeVisible();

    // fármaco que a nota da SBA NÃO cobre precisa declarar isso
    await page.getByRole('button', { name: /Todos os fármacos/ }).click();
    await page.waitForTimeout(500);
    await page.getByText('Sibutramina', { exact: true }).first().click();
    await expect(page.getByText('Fora da nota da SBA').first()).toBeVisible();
    await expect(page.getByText(/Base: Stephens & Katz/).first()).toBeVisible();
  });

  test('mesma medicação num cartão só, que abre em OUTRA TELA', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');
    await abrirCard(page);

    // na lista, a medicação é UM cartão; as duas linhas antigas
    // ("Semaglutida injetável" / "Semaglutida oral") não existem mais soltas
    const grupo = page.getByRole('button', { name: /^Semaglutida/ });
    await expect(grupo).toBeVisible();
    await expect(page.getByRole('button', { name: /^Injetável/ })).toHaveCount(0);
    // a marca é como o paciente chama a medicação — tem de estar no cartão
    // do grupo também, reunindo as das apresentações (dono 25/08)
    await expect(grupo).toContainText('Ozempic · Wegovy · Rybelsus');

    // exenatida diverge entre as apresentações (1 dia × 7 dias) e por isso
    // NÃO leva badge — nem número, nem contagem (dono 25/08)
    const exenatida = page.getByRole('button', { name: /^Exenatida/ });
    await expect(exenatida).not.toContainText(/opções|dias|dia\b/);

    // clicar leva a outra tela, não abre sanfona
    await grupo.click();
    await expect(page.getByRole('heading', { name: 'Semaglutida' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Injetável/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Oral/ })).toBeVisible();
    // a lista ficou para trás
    await expect(page.getByRole('button', { name: /^Liraglutida/ })).toHaveCount(0);
    await page.screenshot({ path: 'e2e/__screenshots__/inibidores-grupo.png', fullPage: true });

    // a apresentação leva ao detalhe DELA
    await page.getByRole('button', { name: /^Injetável/ }).click();
    await expect(page.getByRole('heading', { name: 'Semaglutida injetável' })).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/inibidores-detalhe.png', fullPage: true });

    // e o voltar do detalhe devolve à tela do GRUPO, não à lista
    await page.getByRole('button', { name: /^Semaglutida$/ }).click();
    await expect(page.getByRole('heading', { name: 'Semaglutida' })).toBeVisible();
    await page.getByRole('button', { name: /Todos os fármacos/ }).click();
    await expect(page.getByRole('button', { name: /^Liraglutida/ })).toBeVisible();
  });

  test('anticoagulantes seguem o mesmo agrupamento', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');

    await page.goto('/calculadoras');
    await page.waitForTimeout(2500);
    await page.getByText('Perioperatório e Via Aérea', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByText('Anticoagulantes', { exact: true }).first().click();
    await expect(page.getByRole('tab', { name: 'Bloqueio' })).toBeVisible({ timeout: 10_000 });

    // a HNF ocupava QUATRO linhas na lista; agora é um cartão, e sem badge
    const hnf = page.getByRole('button', { name: /^Heparina não fracionada/ });
    await expect(hnf).toBeVisible();
    await expect(hnf).not.toContainText(/opções/);
    await expect(hnf).toContainText('Liquemine · Hepamax');
    await page.screenshot({ path: 'e2e/__screenshots__/anticoag-lista.png', fullPage: true });
    await expect(page.getByRole('button', { name: /^SC dose alta/ })).toHaveCount(0);

    await hnf.click();
    await expect(page.getByRole('heading', { name: /^Heparina não fracionada/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Endovenosa/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^SC terapêutica/ })).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/anticoag-grupo.png', fullPage: true });

    await page.getByRole('button', { name: /^SC dose alta/ }).click();
    await expect(page.getByRole('heading', { name: /HNF subcutânea — dose alta/ })).toBeVisible();

    /* Mesmo defeito do card irmão, confirmado medindo em 26/08: a barra ficava
       sobre o cartão do fármaco (lendo como sub-abas dele) e a troca de aba
       descartava o fármaco E os dados do paciente (ClCr, idade, plaquetas,
       RNI, última dose), calada. */
    const barraVisivel = await page.evaluate(() => {
      const l = document.querySelector('[role="tablist"]');
      return !!l && l.getBoundingClientRect().height > 0;
    });
    expect(barraVisivel, 'a barra devia sumir dentro do fármaco').toBe(false);

    await page.getByRole('button', { name: /Dados do paciente/ }).click();
    await page.waitForTimeout(400);
    await page.getByLabel(/RNI/).fill('2.5');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await expect(page.getByText(/RNI 2\.5/).first()).toBeVisible();

    // chegamos pelo cartão do grupo, então o voltar do detalhe devolve à tela
    // da HNF; é de lá que se volta para a lista
    await page.getByRole('button', { name: /^Heparina não fracionada/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Todos os fármacos/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('tab', { name: 'Cateter' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('tab', { name: 'Bloqueio' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Heparina não fracionada/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^SC dose alta/ }).click();
    await expect(page.getByText(/RNI 2\.5/).first(), 'os dados do paciente se perderam').toBeVisible();
  });

  test('reversores: badge verde com rótulo e orientações em três assuntos', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');

    await page.goto('/calculadoras');
    await page.waitForTimeout(2500);
    await page.getByText('Perioperatório e Via Aérea', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByText('Anticoagulantes', { exact: true }).first().click();
    await page.getByRole('tab', { name: 'Reversão' }).click();
    await page.waitForTimeout(600);

    // o número sozinho não dizia de quê; e azul não é cor do DS aqui
    await expect(page.getByText('Início Imediato').first()).toBeVisible();
    const badge = page.getByText('Início Imediato').first();
    const cor = await badge.evaluate((el) => getComputedStyle(el).color);
    console.log('cor do badge do reversor:', cor);

    await page.getByRole('button', { name: /Como usar, riscos e disponibilidade/ }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Como usar', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Riscos', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Disponibilidade no Brasil', { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/anticoag-reversores.png', fullPage: true });
  });

  test('o veredito é UM card e a Referência abre os 17 fatores', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');
    await abrirCard(page);

    await page.getByRole('button', { name: /^Liraglutida/ }).click();
    await page.waitForTimeout(500);
    // "Suspender 1 dia antes" era o título do alerta amarelo que duplicava o
    // card Suspensão logo abaixo (dono 26/08). Sobrou um card só.
    await expect(page.getByText('Suspender 1 dia antes')).toHaveCount(0);
    await expect(page.getByText('1 dia antes').first()).toBeVisible();
    await expect(page.getByText(/Meia-vida de ~13 h/).first()).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/inibidores-veredito.png', fullPage: true });

    // a dieta deixou de ser aba e virou o que a decisão manda prescrever
    await expect(page.getByText('O que prescrever').first()).toBeVisible();
    await expect(page.getByText('Na avaliação pré-anestésica').first()).toBeVisible();

    // volta à lista: dentro do fármaco a barra de abas não existe mais
    await page.getByRole('button', { name: /Todos os fármacos/ }).click();
    await page.waitForTimeout(400);

    // os 17 fatores agora são legíveis SEM escolher fármaco
    await page.getByRole('tab', { name: 'Referência' }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText('Quem é alto risco').first()).toBeVisible();
    await expect(page.getByText('Gastroparesia documentada').first()).toBeVisible();
    await expect(page.getByText('Acalasia').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/inibidores-referencia.png', fullPage: true });

    // e o conteúdo cortado não voltou
    await expect(page.getByText(/succinilcolina|Trendelenburg|Pré-oxigenação/)).toHaveCount(0);
  });

  test('dentro do fármaco não há abas, e a avaliação sobrevive à troca', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');
    await abrirCard(page);

    const barraVisivel = () =>
      page.evaluate(() => {
        const l = document.querySelector('[role="tablist"]');
        return !!l && l.getBoundingClientRect().height > 0;
      });

    // encostada num cartão intitulado "Liraglutida", a barra lia como
    // sub-abas DAQUELE remédio (dono 26/08)
    expect(await barraVisivel(), 'a barra some na lista').toBe(true);
    await page.getByRole('button', { name: /^Liraglutida/ }).click();
    await page.waitForTimeout(400);
    expect(await barraVisivel(), 'a barra devia sumir dentro do fármaco').toBe(false);

    // marca um fator na avaliação do paciente
    await page.getByRole('button', { name: /Avaliação do paciente/ }).click();
    await page.waitForTimeout(400);
    await page.getByText('Sintomas gastrointestinais', { exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await expect(page.getByText(/1 fator/).first()).toBeVisible();

    await page.getByRole('button', { name: /Todos os fármacos/ }).click();
    await page.waitForTimeout(400);
    expect(await barraVisivel(), 'a barra volta na lista').toBe(true);

    /* ⚠️ TabsContent DESMONTA o painel inativo: com o estado dentro da aba,
       esta ida e volta descartava o fármaco E a avaliação inteira — 17
       checkboxes, data e hora da última dose, toggle do POCUS —, calada. */
    await page.getByRole('tab', { name: 'Referência' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('tab', { name: 'Pré-op' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Liraglutida/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/1 fator/).first(), 'a avaliação do paciente se perdeu').toBeVisible();
  });

  test('POCUS: a fórmula de Perlas calcula na tela', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await entrar(page, 'light');
    await abrirCard(page);

    await page.getByRole('tab', { name: 'No dia' }).click();
    await page.waitForTimeout(600);

    await page.getByLabel(/Diâmetro AP/).fill('3.2');
    await page.getByLabel(/Diâmetro CC/).fill('4.1');
    await page.getByLabel(/Idade/).fill('58');
    await page.getByLabel(/Peso/).fill('82');
    await page.waitForTimeout(400);

    // ACSA 10,3 cm² · idade 58 → 27 + 150,4 − 74,2 = 103,2 mL → 1,26 mL/kg
    // vírgula, não ponto: o resto do card escreve "1,5 mL/kg" e dois
    // separadores na mesma tela fazem duvidar da conta
    await expect(page.getByText('1,26 mL/kg').first()).toBeVisible();
    await expect(page.getByText('ACSA 10,3 cm²').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/inibidores-pocus.png', fullPage: true });
  });
});
