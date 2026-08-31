/**
 * Travas do formato de número do sistema de calculadoras (31/08/2026).
 *
 * O app escreve em português: vírgula decimal e ponto de milhar. A migração dos
 * 139 `toFixed` e das 249 strings clínicas só é segura porque os campos que são
 * ao mesmo tempo EXIBIDOS e PARSEADOS passaram a ser lidos por `numeroFlexivel`.
 *
 * ⚠️ O modo de falha que estes testes existem para pegar não dá erro: se o
 * parser voltar a ser `parseFloat`, `parseFloat('0,04')` devolve 0 e a DOSE sai
 * ZERO — silenciosamente, com a tela montada e sem exceção nenhuma.
 */
import { describe, it, expect } from 'vitest';
import { numeroBr, numeroFlexivel } from '@/lib/numeroBr';
import { getCalculatorById } from '@/design-system/data/calculator-definitions';
import { numeroDeTexto } from '../helpers/numeroDeTexto';

describe('numeroBr — o app escreve em português', () => {
  it('vírgula no decimal', () => {
    expect(numeroBr(12.75, 2)).toBe('12,75');
    expect(numeroBr(0.5, 1)).toBe('0,5');
  });

  it('ponto no milhar', () => {
    expect(numeroBr(4900)).toBe('4.900');
    expect(numeroBr(1234.5, 1)).toBe('1.234,5');
  });

  it('o que não é número vira travessão, não "NaN"', () => {
    expect(numeroBr(undefined)).toBe('—');
    expect(numeroBr(null)).toBe('—');
    expect(numeroBr(Infinity)).toBe('—');
  });
});

describe('numeroFlexivel — lê os dois formatos', () => {
  it('aceita vírgula, que é como o dado é escrito hoje', () => {
    expect(numeroFlexivel('0,5')).toBeCloseTo(0.5, 6);
    expect(numeroFlexivel('0,04')).toBeCloseTo(0.04, 6);
    expect(numeroFlexivel('1.234,5')).toBeCloseTo(1234.5, 6);
  });

  it('continua aceitando ponto, para dado antigo não virar zero', () => {
    expect(numeroFlexivel('0.5')).toBeCloseTo(0.5, 6);
    expect(numeroFlexivel('12')).toBe(12);
  });
});

describe('doses_adultos — dose escrita com vírgula não pode virar zero', () => {
  const dosesDe = (peso) => {
    const r = getCalculatorById('doses_adultos').compute({ peso });
    return r.categorias.flatMap((c) => c.medicamentos);
  };

  it('nenhuma dose calculada é zero', () => {
    const meds = dosesDe(70);
    expect(meds.length).toBeGreaterThan(10);
    const zeradas = meds.filter((m) => numeroDeTexto(m.dose) === 0);
    expect(zeradas.map((m) => m.droga)).toEqual([]);
  });

  /* ⚠️ Esta trava nasceu de um defeito que passou pela migração inteira: o ramo
   * de dose FIXA interpolava o número cru (`${doseMin}`) em vez de formatar, e
   * flumazenil e naloxona apareciam como "0.2-0.5 mg" e "0.04-0.4 mg" ao lado
   * das doses por kg já com vírgula, na MESMA lista. Não quebrou teste nenhum
   * — só quem abriu a tela veria. */
  it('nenhuma dose exibida usa ponto decimal, nem as de dose fixa', () => {
    for (const peso of [15, 70, 100]) {
      /* ⚠️ /\d\.\d/ acusaria o separador de MILHAR: "2.100,0 mcg" é correto.
       * Ponto de milhar vem sempre seguido de exatamente 3 dígitos; decimal
       * vem com 1-2 (ou 4+, que também não é milhar). */
      const pontoDecimal = /\.\d{1,2}(?!\d)|\.\d{4,}/;
      const comPonto = dosesDe(peso).filter((m) => pontoDecimal.test(m.dose));
      expect(comPonto.map((m) => `${m.droga}: ${m.dose}`)).toEqual([]);
    }
  });

  /* ⚠️ O campo `dosePadrao` faz DOIS trabalhos: é o texto que aparece na tela E
   * a fonte de onde a dose é calculada (`split('-').map(numeroFlexivel)`).
   * Reescrever o texto, portanto, MUDA A DOSE — e falha em silêncio:
   *
   *   "1,5-2,5"    → [1,5 · 2,5] → 105-175 mg   (certo)
   *   "1,5 a 2,5"  → [1,5]       → 105-105 mg   (o teto some)
   *   "1,5 – 2,5"  → [1,5]       → 105-105 mg   (travessão de copiar-colar)
   *
   * Nenhum vira zero, então a trava de "dose não é zero" NÃO pega. Esta pega:
   * quantos números o TEXTO mostra tem de ser quantos números o parse extrai. */
  it('o separador da faixa não pode ser reescrito sem quebrar a dose', () => {
    const quebrados = [];
    for (const m of dosesDe(70)) {
      const texto = String(m.dosePadrao);
      const naTela = (texto.match(/\d+(?:[.,]\d+)?/g) || []).length;
      const noParse = texto.split('-').map((d) => numeroFlexivel(d)).filter(Number.isFinite).length;
      if (naTela !== noParse) quebrados.push(`${m.droga}: "${texto}" mostra ${naTela}, extrai ${noParse}`);
    }
    expect(quebrados).toEqual([]);
  });

  it('a dose por kg escala com o peso — é o que o parse quebrado apagaria', () => {
    const leve = dosesDe(50);
    const pesado = dosesDe(100);
    let escalaram = 0;
    for (let i = 0; i < leve.length; i++) {
      const a = numeroDeTexto(leve[i].dose);
      const b = numeroDeTexto(pesado[i].dose);
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) escalaram++;
    }
    // a maioria é por kg; algumas são fixas de propósito
    expect(escalaram).toBeGreaterThan(5);
  });
});
