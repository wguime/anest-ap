/**
 * Trava dos Critérios UTI depois da revisão por evidência (29/08/2026).
 *
 * O critério de permanência é: **validada para decidir encaminhamento de
 * paciente PERIOPERATÓRIO à UTI** — não "é ferramenta de terapia intensiva".
 *
 * Saíram duas:
 *
 * - `potter` — NÃO é o POTTER. O próprio arquivo admite que o algoritmo
 *   original é proprietário e que aquilo é uma árvore feita à mão. Sem
 *   validação nenhuma, mas exibindo as referências de validação do POTTER
 *   verdadeiro (Bertsimas 2018, Kaafarani 2021). Credibilidade emprestada.
 * - `ppossum` — validada para morbimortalidade, não para a decisão, e parte
 *   das 18 variáveis é intra e pós-operatória: não existe no momento em que se
 *   decide encaminhar. SORT (6 variáveis pré-op) e SAS (3 ao fim da cirurgia)
 *   cobrem os dois momentos.
 *
 * ⚠️ Nada foi apagado: as duas seguem exportadas do módulo e voltam à lista com
 * uma linha. Só saíram de `ALL_CALCULATORS`.
 *
 * E a ESS deixou de somar `racaBranca`: a variável vem da derivação americana
 * (ACS-NSQIP) e validações internacionais a omitem por refletir confundidor
 * socioeconômico, não risco biológico — o próprio arquivo já dizia isso e ainda
 * assim somava o ponto. O app usa CKD-EPI 2021 *race-free* na calculadora renal,
 * criada para remover exatamente esse tipo de coeficiente.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_CALCULATORS,
  ESS_CALCULATOR,
  POTTER_CALCULATOR,
  PPOSSUM_CALCULATOR,
  getCalculatorById,
} from '../../data/criteriosUtiCalculators';

const todasEntradas = (calc) =>
  (calc.sections || []).flatMap((s) => s.inputs || []).concat(calc.inputs || []);

describe('a lista tem só as validadas para a decisão', () => {
  it('são exatamente 5', () => {
    expect(ALL_CALCULATORS).toHaveLength(5);
  });

  it.each([
    ['sort', 'SORT'],
    ['ess', 'ESS'],
    ['sas', 'SAS'],
    ['siaarti', 'SIAARTI 2025'],
    ['cfm2156', 'CFM 2156'],
  ])('%s continua na lista', (id, nome) => {
    const c = ALL_CALCULATORS.find((x) => x.id === id);
    expect(c, `${nome} sumiu`).toBeTruthy();
    expect(c.name).toBe(nome);
  });

  it.each([['potter'], ['ppossum']])('%s saiu da lista', (id) => {
    expect(ALL_CALCULATORS.find((x) => x.id === id)).toBeUndefined();
  });

  // "Nada é apagado": as definições continuam no módulo e voltam com uma linha.
  it('as duas que saíram continuam exportadas do módulo', () => {
    expect(POTTER_CALCULATOR.id).toBe('potter');
    expect(PPOSSUM_CALCULATOR.id).toBe('ppossum');
  });

  it('getCalculatorById só encontra as que estão na lista', () => {
    expect(getCalculatorById('sort')).toBeTruthy();
    expect(getCalculatorById('potter')).toBeUndefined();
    expect(getCalculatorById('ppossum')).toBeUndefined();
  });
});

describe('ESS — sem coeficiente racial', () => {
  it('a variável "raça branca" não pontua mais', () => {
    const raca = todasEntradas(ESS_CALCULATOR).find((i) => i.id === 'racaBranca');
    expect(raca, 'a entrada deveria ter saído inteira').toBeUndefined();
  });

  it('nenhuma entrada da ESS menciona raça', () => {
    const suspeitas = todasEntradas(ESS_CALCULATOR)
      .filter((i) => /ra[çc]a|branca|negr|pard|white|black/i.test(`${i.id} ${i.label}`))
      .map((i) => i.label);
    expect(suspeitas).toEqual([]);
  });

  it('a nota explicando a remoção continua visível', () => {
    expect(ESS_CALCULATOR.disclaimer).toMatch(/ra[çc]a/i);
  });

  it('a seção Demografia continua com as demais variáveis', () => {
    const ids = todasEntradas(ESS_CALCULATOR).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['idade60', 'transferPs', 'transferInternacao']));
  });
});
