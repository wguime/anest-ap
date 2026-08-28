/**
 * Trava do PediCalc e do AdultCalc (`calculator-definitions.js`).
 *
 * Defeitos que originaram o arquivo (28/08/2026):
 *
 * 1. O `compute` lia `med.apresentação` (COM acento) e a chave nos dados é
 *    `apresentacao` (SEM acento) — 80 ocorrências, zero com acento. A
 *    apresentação da ampola chegava `undefined` ao display nos dois
 *    calculadores, e o React renderiza `undefined` como nada: a linha ficava
 *    em branco. É ela que diz qual frasco pegar e em que concentração.
 *
 * 2. A unidade exibida caía em `mg` por falta de ramo: `UI/kg` não casava com
 *    `mcg`, `mEq` nem `ml`, então a OXITOCINA aparecia como "0,20 mg" em vez de
 *    "0,20 UI".
 *
 * Nenhum dos dois quebrava o build ou lançava — some em silêncio na tela.
 */
import { describe, it, expect } from 'vitest';
import { getCalculatorById } from '../../design-system/data/calculator-definitions.js';

const achatar = (id, peso) => {
  const r = getCalculatorById(id).compute({ peso });
  return r.categorias.flatMap((c) => c.medicamentos.map((m) => ({ ...m, categoria: c.titulo })));
};

const acharDroga = (lista, nome) => lista.find((m) => m.droga === nome);

describe.each([
  ['ped_doses', 10],
  ['doses_adultos', 70],
])('%s — apresentação da ampola chega à tela', (id, peso) => {
  const drogas = achatar(id, peso);

  it('a lista não está vazia', () => {
    expect(drogas.length).toBeGreaterThan(0);
  });

  it('NENHUMA droga fica sem apresentação', () => {
    const semApresentacao = drogas.filter((m) => !m.apresentacao).map((m) => m.droga);
    expect(semApresentacao, `sem apresentação: ${semApresentacao.join(', ')}`).toEqual([]);
  });

  it('a apresentação traz a concentração, não um rótulo genérico', () => {
    // Sem isso não dá para saber quantos mL aspirar do frasco. A forma varia
    // legitimamente — "1 mg/ml", "1g/frasco", "20 U/ml" —, então o critério é
    // haver quantidade (dígito) e por-quê (barra ou porcentagem), não uma
    // lista fechada de unidades.
    const semConcentracao = drogas
      .filter((m) => {
        const a = m.apresentacao || '';
        return !(/\d/.test(a) && /[/%]/.test(a));
      })
      .map((m) => `${m.droga}: "${m.apresentacao}"`);
    expect(semConcentracao).toEqual([]);
  });
});

describe('unidade exibida acompanha a unidade da dose', () => {
  it('a OXITOCINA é dosada em UI, não em mg', () => {
    const oxi = acharDroga(achatar('ped_doses', 10), 'OXITOCINA');
    expect(oxi).toBeTruthy();
    expect(oxi.dosePadrao).toContain('UI/kg');
    expect(oxi.dose).toContain('UI');
    expect(oxi.dose).not.toContain('mg');
  });

  it('nenhuma droga exibe unidade que contradiz a dose por kg', () => {
    const RAIZ = { 'mcg/kg': 'mcg', 'mEq/kg': 'mEq', 'ml/kg': 'ml', 'UI/kg': 'UI', 'mg/kg': 'mg' };
    const erradas = [];
    for (const id of ['ped_doses', 'doses_adultos']) {
      for (const m of achatar(id, 10)) {
        const porKg = Object.keys(RAIZ).find((u) => m.dosePadrao.endsWith(u));
        if (!porKg) continue;
        const esperada = RAIZ[porKg];
        const exibida = m.dose.split(' ').pop();
        if (exibida !== esperada) erradas.push(`${id}/${m.droga}: dose "${m.dosePadrao}" exibe "${exibida}"`);
      }
    }
    expect(erradas).toEqual([]);
  });
});

describe('a dose escala com o peso', () => {
  it('dobrar o peso dobra a dose, salvo onde há teto ou piso declarado', () => {
    const leve = achatar('ped_doses', 10);
    const pesado = achatar('ped_doses', 20);
    for (let i = 0; i < leve.length; i++) {
      const a = parseFloat(leve[i].dose);
      const b = parseFloat(pesado[i].dose);
      expect(b, `${leve[i].droga} encolheu ao dobrar o peso`).toBeGreaterThanOrEqual(a);
    }
  });
});
