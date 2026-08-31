/**
 * Trava da triagem das calculadoras (proposta em `docs/revisao-calculadoras-triagem.md`,
 * aprovada pelo dono em 29/08/2026).
 *
 * 20 calculadoras passam a `status: 'inactive'`. **Nada é apagado** — a definição
 * inteira continua no arquivo e volta com a troca de uma palavra. Foi condição
 * explícita do dono: *"as que forem descartadas quero que deixe inativas caso eu
 * mude de ideia e resolva retornar com elas no app"*.
 *
 * Dois grupos, com forças de evidência diferentes:
 *
 * - **Superadas por algo que o app JÁ TEM.** Estas ganham entrada em
 *   `LEGACY_ID_MAP` apontando para a sucessora, porque existe para onde mandar
 *   quem tinha a antiga favoritada.
 * - **De outra especialidade.** Estas NÃO ganham entrada: não há sucessora, e
 *   inventar um destino seria pior que não ter.
 *
 * ⚠️ Favorito não pode ressuscitar calculadora inativa. `getAllCalculators()`
 * inclui as inativas de propósito (é o que permite o `LEGACY_ID_MAP` resolver),
 * então a lista de favoritas precisa filtrar por status — senão desativar não
 * desativa para quem favoritou.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatorSections,
  getAllCalculators,
  getActiveCalculators,
  getSectionsWithCalculators,
  getCalculatorById,
} from '../../design-system/data/calculator-definitions.js';

// Superadas — têm sucessora no app
const SUPERADAS = {
  risco_goldman: 'risco_rcri',
  uti_apache2: 'uti_saps3',
  ped_cheops: 'ped_flacc',
  seg_mews: 'seg_news2',
};

// De outra especialidade — sem sucessora
const OUTRA_ESPECIALIDADE = [
  'risco_timi', 'risco_heart', 'risco_padua',
  'uti_curb65', 'uti_cpis', 'uti_nutric', 'uti_rox', 'uti_four_score',
  'seg_morse', 'seg_braden',
  'neuro_nihss', 'periop_murray',
  'ped_pews', 'ped_psofa', 'ped_pim3', 'ped_prism3',
];

const DESATIVADAS = [...Object.keys(SUPERADAS), ...OUTRA_ESPECIALIDADE];

const buscarBruto = (id) => getAllCalculators().find((c) => c.id === id);

describe('as 20 saíram da lista, sem serem apagadas', () => {
  it('são exatamente 20', () => {
    expect(DESATIVADAS).toHaveLength(20);
  });

  it.each(DESATIVADAS)('%s está inactive', (id) => {
    const c = buscarBruto(id);
    expect(c, `${id} sumiu do arquivo — deveria estar inactive, não apagada`).toBeTruthy();
    expect(c.status).toBe('inactive');
  });

  it.each(DESATIVADAS)('%s continua com a definição inteira, pronta para voltar', (id) => {
    const c = buscarBruto(id);
    expect(c.title, `${id} sem título`).toBeTruthy();
    // `compute` OU `customRender`: algumas calculam no display.
    expect(Boolean(c.compute || c.customRender), `${id} perdeu a conta`).toBe(true);
  });

  it('nenhuma delas aparece nas seções visíveis', () => {
    const visiveis = getSectionsWithCalculators().flatMap((s) => s.calculators.map((c) => c.id));
    const vazando = DESATIVADAS.filter((id) => visiveis.includes(id));
    expect(vazando).toEqual([]);
  });
});

describe('LEGACY_ID_MAP — só para quem tem sucessora', () => {
  it.each(Object.entries(SUPERADAS))('favorito em %s resolve para %s', (antigo, sucessora) => {
    const c = getCalculatorById(antigo);
    expect(c, `${antigo} não resolveu`).toBeTruthy();
    expect(c.id).toBe(sucessora);
    expect(c.status).toBe('active');
  });

  it('as de outra especialidade NÃO ganham destino inventado', () => {
    for (const id of OUTRA_ESPECIALIDADE) {
      const c = getCalculatorById(id);
      // Resolve para ela mesma (inativa), nunca para outra calculadora.
      expect(c?.id, `${id} foi redirecionada para algo`).toBe(id);
    }
  });
});

describe('card de Classificações — 3 viram 1', () => {
  // ASA, Mallampati e Cormack devolviam a classe que o usuário acabara de
  // escolher: consulta, não cálculo. As três seguem no arquivo como `inactive`
  // e redirecionam para o card, então favorito antigo não vira tela morta.
  it.each(['periop_asa', 'periop_mallampati', 'periop_cormack'])('%s está inactive', (id) => {
    expect(buscarBruto(id)?.status).toBe('inactive');
  });

  it.each(['periop_asa', 'periop_mallampati', 'periop_cormack'])(
    'favorito em %s abre o card de Classificações',
    (id) => {
      expect(getCalculatorById(id)?.id).toBe('periop_classificacoes');
    },
  );

  it('o card existe, está ativo e usa o display próprio', () => {
    const card = buscarBruto('periop_classificacoes');
    expect(card?.status).toBe('active');
    expect(card?.customRender).toBe('classificacoes');
  });

  it('o ASA continua sendo entrada da SORT e da P-POSSUM — a definição não sumiu', () => {
    // Agrupar preserva as definições e os exemplos de cada classe; excluir, não.
    const asa = buscarBruto('periop_asa');
    expect(asa.inputs.find((i) => i.id === 'asa')?.options).toHaveLength(6);
  });
});

describe('duplicatas de fluidos — auditoria de 30/08/2026', () => {
  // `docs/auditoria-calculadoras-uso-real.md` §6.1. O Balanço Hídrico
  // Transoperatório faz a conta 4-2-1 + jejum (que era o `hemo_deficit`
  // inteiro) e o terceiro espaço por porte (que era o `ped_fluidos`), para
  // adulto e pediátrico, mantendo o acompanhamento hora a hora. `hemo_holliday`
  // já havia saído por este mesmo motivo — a triagem de 29/08 viu o eixo e
  // parou no meio dele.
  const DUPLICATAS_DE_FLUIDO = ['hemo_deficit', 'ped_fluidos'];

  it.each(DUPLICATAS_DE_FLUIDO)('%s está inactive', (id) => {
    expect(buscarBruto(id)?.status).toBe('inactive');
  });

  it.each(DUPLICATAS_DE_FLUIDO)('%s continua no arquivo, pronta para voltar', (id) => {
    const c = buscarBruto(id);
    expect(c?.compute, `${id} perdeu a conta`).toBeTypeOf('function');
  });

  it.each(DUPLICATAS_DE_FLUIDO)('favorito em %s abre o Balanço Hídrico Transoperatório', (id) => {
    // O destino é uma das 3 calculadoras com favorito registrado no grupo —
    // aqui o redirecionamento não é hipótese.
    const c = getCalculatorById(id);
    expect(c?.id).toBe('adt_balanco_hidrico_transop');
    expect(c?.status).toBe('active');
  });

  it('o sucessor cobre adulto e pediátrico, que é o que justifica o corte', () => {
    const sucessor = buscarBruto('adt_balanco_hidrico_transop');
    expect(sucessor.subtitle).toContain('adulto e pediátrico');
  });

  it('o Holliday-Segar pediátrico FICA — é o único com a regra diária 100-50-20', () => {
    const c = buscarBruto('ped_holliday_segar');
    expect(c?.status).toBe('active');
    expect(c.compute({ peso: 20 }).details.ml24h).toBe(1500);
  });

  it('nenhum texto de tela aponta para uma calculadora inativa', () => {
    // O `keyPoints` do sucessor citava "alinhado com ped_fluidos" — id interno
    // em texto de usuário, e agora apontando para card morto.
    const inativas = getAllCalculators().filter((c) => c.status === 'inactive').map((c) => c.id);
    const textos = getActiveCalculators().flatMap((c) => [
      ...(c.infoBox?.keyPoints || []),
      ...(c.infoBox?.warnings || []),
      c.infoBox?.interpretation || '',
      c.subtitle || '',
    ]);
    const vazando = textos.filter((t) => inativas.some((id) => t.includes(id)));
    expect(vazando).toEqual([]);
  });
});

describe('o que sobra', () => {
  it('as ativas são 59', () => {
    // 76 − 20 da triagem = 56; menos ASA/Mallampati/Cormack, mais o card = 54;
    // menos hemo_deficit e ped_fluidos (duplicatas de fluido) = 52;
    // mais as 7 acrescentadas pela auditoria por recomendação de diretriz = 59.
    expect(getActiveCalculators()).toHaveLength(59);
  });

  it('nenhuma seção fica vazia na tela', () => {
    const vazias = getSectionsWithCalculators()
      .filter((s) => s.calculators.length === 0)
      .map((s) => s.title);
    expect(vazias).toEqual([]);
  });

  it.each([
    'risco_rcri', 'risco_caprini', 'risco_fa_anticoag',
    'uti_saps3', 'uti_sofa_unificado', 'uti_sedacao_delirium', 'seg_news2',
    'ped_flacc', 'periop_apfel', 'periop_stopbang', 'periop_ariscat',
  ])('%s continua ativa', (id) => {
    expect(buscarBruto(id)?.status).toBe('active');
  });

  it('o total de definições só cresce — nada é apagado', () => {
    // 80 originais + 5 de Indicação de UTI + 1 card de Classificações = 86,
    // + 7 acréscimos com recomendação de diretriz (auditoria §7) = 93.
    expect(getAllCalculators()).toHaveLength(93);
  });
});

describe('favorito não ressuscita calculadora inativa', () => {
  // `getAllCalculators()` inclui inativas de propósito (é o que faz o
  // LEGACY_ID_MAP resolver). Quem monta a lista de favoritas precisa filtrar.
  it('a seção de favoritas usa apenas calculadoras não-inativas', () => {
    const fonte = getSectionsWithCalculators().flatMap((s) => s.calculators);
    const inativasVazando = fonte.filter((c) => c.status === 'inactive').map((c) => c.id);
    expect(inativasVazando).toEqual([]);
  });
});

describe('a estrutura de seções segue íntegra', () => {
  it('toda calculadora tem id único', () => {
    const ids = getAllCalculators().map((c) => c.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos).toEqual([]);
  });

  it('toda seção declara título e ícone', () => {
    for (const s of calculatorSections) {
      expect(s.title, `${s.id} sem título`).toBeTruthy();
      expect(s.icon, `${s.id} sem ícone`).toBeTruthy();
    }
  });
});
