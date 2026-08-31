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
import { numeroDeTexto } from '../helpers/numeroDeTexto';
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

// ---------------------------------------------------------------------------
// Doses corrigidas por evidência (29/08/2026)
// ---------------------------------------------------------------------------

describe('ADENOSINA — o teto é absoluto, não por kg', () => {
  // O campo `doseMaxima` é comparado pelo código contra a dose JÁ multiplicada
  // pelo peso, ou seja, é um teto em mg absolutos. O valor estava `0.3`, que a
  // própria `obs` da droga descreve como mg/kg — então toda criança acima de
  // 3 kg era travada em 0,3 mg.
  // PALS/AHA 2020: 1ª dose 0,1 mg/kg, máximo 6 mg (2ª dose 0,2 mg/kg, máx 12 mg).
  const doseDe = (peso) => {
    const l = getCalculatorById('ped_doses').compute({ peso })
      .categorias.flatMap((c) => c.medicamentos);
    return numeroDeTexto(l.find((m) => m.droga === 'ADENOSINA').dose);
  };

  it.each([
    [5, 0.5],
    [10, 1.0],
    [20, 2.0],
    [40, 4.0],
    [60, 6.0],   // 0,1 mg/kg = 6 mg, exatamente no teto
    [80, 6.0],   // acima do teto, trava em 6 mg — e não em 0,3
  ])('%i kg → %s mg', (peso, esperado) => {
    expect(doseDe(peso)).toBeCloseTo(esperado, 2);
  });

  it('nenhum peso pediátrico devolve os antigos 0,3 mg', () => {
    for (const peso of [4, 5, 8, 10, 15, 20, 30, 40, 50]) {
      expect(doseDe(peso), `${peso} kg`).toBeGreaterThan(0.3);
    }
  });
});

describe('GLUCONATO de cálcio — a dose é a do gluconato, não a do cloreto', () => {
  // Gluconato de cálcio 10% e cloreto de cálcio 10% são ambos 100 mg/mL, mas o
  // cloreto tem ~3× mais cálcio elementar por mL. Daí as doses diferentes:
  // cloreto 20 mg/kg · gluconato 60–100 mg/kg (máx 2 g).
  // O app usava 20 mg/kg sob o rótulo "GLUCO Ca 10%" — a dose do cloreto.
  // O ACLS adulto do PRÓPRIO app já usava 0,5–1 mL/kg (50–100 mg/kg).
  const gluconato = (peso) => {
    const l = getCalculatorById('ped_doses').compute({ peso })
      .categorias.flatMap((c) => c.medicamentos);
    return l.find((m) => m.droga.includes('GLUCO'));
  };

  it.each([
    [5, 300],
    [10, 600],
    [20, 1200],
    [30, 1800],
    [40, 2000],  // teto de 2 g
  ])('%i kg → %s mg', (peso, esperado) => {
    expect(numeroDeTexto(gluconato(peso).dose)).toBeCloseTo(esperado, 1);
  });

  it('60 mg/kg equivale a 0,6 mL/kg da solução a 10% — a faixa do ACLS adulto', () => {
    // Diluição declarada: 10 mL + 10 mL AD → 50 mg/mL. 10 kg → 600 mg → 12 mL
    // do diluído = 6 mL do puro a 100 mg/mL = 0,6 mL/kg.
    expect(numeroDeTexto(gluconato(10).volume)).toBeCloseTo(12, 1);
  });

  it('a dose padrão declarada na tela é 60 mg/kg', () => {
    expect(gluconato(10).dosePadrao).toBe('60 mg/kg');
  });
});

describe('a dose escala com o peso', () => {
  it('dobrar o peso dobra a dose, salvo onde há teto ou piso declarado', () => {
    const leve = achatar('ped_doses', 10);
    const pesado = achatar('ped_doses', 20);
    for (let i = 0; i < leve.length; i++) {
      const a = numeroDeTexto(leve[i].dose);
      const b = numeroDeTexto(pesado[i].dose);
      expect(b, `${leve[i].droga} encolheu ao dobrar o peso`).toBeGreaterThanOrEqual(a);
    }
  });
});
