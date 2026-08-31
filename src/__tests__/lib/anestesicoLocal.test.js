/**
 * Dose máxima de anestésico local (`src/lib/anestesicoLocal.js`).
 *
 * A trava que importa é o TETO ABSOLUTO vencendo o cálculo por peso: é ele que
 * impede um paciente de 120 kg receber 840 mg de lidocaína com adrenalina.
 * Fonte da tabela: Iowa Head and Neck Protocols, University of Iowa.
 */
import { describe, it, expect } from 'vitest';
import {
  ANESTESICOS_LOCAIS,
  mgPorMl,
  doseMaximaAnestesicoLocal,
} from '../../lib/anestesicoLocal.js';

const dose = (farmaco, pesoKg, comVasoconstritor, concentracaoPercent) =>
  doseMaximaAnestesicoLocal({ farmaco, pesoKg, comVasoconstritor, concentracaoPercent });

describe('conversão de concentração', () => {
  it.each([[0.25, 2.5], [0.5, 5], [1, 10], [2, 20], [0.75, 7.5]])(
    '%s%% → %s mg/mL',
    (percent, mgml) => {
      expect(mgPorMl(percent)).toBe(mgml);
    },
  );

  it('concentração inválida devolve null', () => {
    expect(mgPorMl(0)).toBeNull();
    expect(mgPorMl(-1)).toBeNull();
    expect(mgPorMl(NaN)).toBeNull();
  });
});

describe('dose por peso', () => {
  it('lidocaína sem adrenalina, 70 kg → 315 mg (4,5 mg/kg)', () => {
    expect(dose('lidocaina', 70, false, 2).doseMaximaMg).toBeCloseTo(315, 5);
  });

  it('lidocaína com adrenalina, 70 kg → 490 mg (7 mg/kg), abaixo do teto', () => {
    const r = dose('lidocaina', 70, true, 2);
    expect(r.doseMaximaMg).toBeCloseTo(490, 5);
    expect(r.limitadoPeloTeto).toBe(false);
  });

  it('a adrenalina aumenta o teto em todos os fármacos que a admitem', () => {
    for (const [id, dados] of Object.entries(ANESTESICOS_LOCAIS)) {
      expect(dados.comVaso, `${id}`).toBeGreaterThanOrEqual(dados.semVaso);
    }
  });
});

describe('o teto absoluto vence o cálculo por peso', () => {
  it('lidocaína com adrenalina em 100 kg para em 500 mg, não em 700', () => {
    const r = dose('lidocaina', 100, true, 2);
    expect(r.doseporPeso).toBeCloseTo(700, 5);
    expect(r.doseMaximaMg).toBe(500);
    expect(r.limitadoPeloTeto).toBe(true);
  });

  it('bupivacaína sem adrenalina em 100 kg para em 175 mg, não em 250', () => {
    const r = dose('bupivacaina', 100, false, 0.5);
    expect(r.doseporPeso).toBeCloseTo(250, 5);
    expect(r.doseMaximaMg).toBe(175);
    expect(r.limitadoPeloTeto).toBe(true);
  });

  it('exatamente no teto não é "limitado" — a conta por peso ainda vale', () => {
    // Bupivacaína sem vaso: 2,5 mg/kg × 70 kg = 175 mg = o teto.
    const r = dose('bupivacaina', 70, false, 0.5);
    expect(r.doseMaximaMg).toBe(175);
    expect(r.limitadoPeloTeto).toBe(false);
  });

  it('a dose máxima NUNCA passa do teto absoluto, em nenhum peso', () => {
    for (const [id, dados] of Object.entries(ANESTESICOS_LOCAIS)) {
      for (const comVaso of [false, true]) {
        const teto = comVaso ? dados.tetoMgComVaso : dados.tetoMgSemVaso;
        if (!Number.isFinite(teto)) continue;
        for (const peso of [50, 70, 100, 150, 200]) {
          const r = dose(id, peso, comVaso, 1);
          expect(r.doseMaximaMg, `${id} ${comVaso ? 'c/' : 's/'} vaso, ${peso} kg`).toBeLessThanOrEqual(teto);
        }
      }
    }
  });
});

describe('volume na seringa', () => {
  it('315 mg de lidocaína a 2% → 15,75 mL', () => {
    expect(dose('lidocaina', 70, false, 2).volumeMaximoMl).toBeCloseTo(15.75, 3);
  });

  it('a mesma dose rende o dobro do volume na metade da concentração', () => {
    const a = dose('lidocaina', 70, false, 2).volumeMaximoMl;
    const b = dose('lidocaina', 70, false, 1).volumeMaximoMl;
    expect(b).toBeCloseTo(a * 2, 5);
  });

  it('175 mg de bupivacaína a 0,5% → 35 mL', () => {
    expect(dose('bupivacaina', 70, false, 0.5).volumeMaximoMl).toBeCloseTo(35, 3);
  });

  it('sem concentração, a dose em mg continua saindo', () => {
    const r = dose('lidocaina', 70, false, undefined);
    expect(r.doseMaximaMg).toBeCloseTo(315, 5);
    expect(r.volumeMaximoMl).toBeNull();
  });
});

describe('entradas inválidas', () => {
  it('fármaco desconhecido → null', () => {
    expect(dose('inexistente', 70, false, 1)).toBeNull();
  });

  it('peso ausente ou zero → null', () => {
    expect(dose('lidocaina', 0, false, 1)).toBeNull();
    expect(dose('lidocaina', NaN, false, 1)).toBeNull();
  });
});

describe('a tabela está íntegra', () => {
  it('todo fármaco declara nome, grupo, faixas e concentrações', () => {
    for (const [id, d] of Object.entries(ANESTESICOS_LOCAIS)) {
      expect(d.nome, id).toBeTruthy();
      expect(['Amida', 'Éster'], id).toContain(d.grupo);
      expect(d.faixaSemVaso, id).toBeTruthy();
      expect(d.faixaComVaso, id).toBeTruthy();
      expect(Array.isArray(d.concentracoes) && d.concentracoes.length, id).toBeTruthy();
    }
  });
});
