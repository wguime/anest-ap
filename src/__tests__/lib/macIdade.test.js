/**
 * CAM corrigida pela idade (`src/lib/macIdade.js`).
 *
 * Trava do número que dá sentido ao card: ~6% de queda por década (Mapleson,
 * BJA 1996), e a soma das frações vapor + N₂O como na sub-rotina de Nickalls.
 */
import { describe, it, expect } from 'vitest';
import {
  B_MAPLESON,
  MAC_40,
  macNaIdade,
  idadeForaDaValidacao,
  fracaoMacTotal,
} from '../../lib/macIdade.js';

describe('a constante é a de Mapleson', () => {
  it('b = −0,00269', () => {
    expect(B_MAPLESON).toBe(-0.00269);
  });

  it('que é exatamente ~6% de queda por década', () => {
    const porDecada = Math.pow(10, B_MAPLESON * 10);
    expect((1 - porDecada) * 100).toBeCloseTo(6, 1);
  });
});

describe('CAM na idade', () => {
  it.each(Object.entries(MAC_40))('aos 40 anos, %s devolve o próprio MAC40 (%s)', (agente, mac40) => {
    expect(macNaIdade(agente, 40)).toBeCloseTo(mac40, 10);
  });

  it('sevoflurano aos 80 anos → 1,40% (era 1,8 aos 40)', () => {
    expect(macNaIdade('sevoflurano', 80)).toBeCloseTo(1.405, 2);
  });

  it('sevoflurano aos 20 anos → 2,04%', () => {
    expect(macNaIdade('sevoflurano', 20)).toBeCloseTo(2.037, 2);
  });

  it('desflurano aos 80 → 5,15% e isoflurano aos 80 → 0,91%', () => {
    expect(macNaIdade('desflurano', 80)).toBeCloseTo(5.152, 2);
    expect(macNaIdade('isoflurano', 80)).toBeCloseTo(0.913, 2);
  });

  it('cai monotonicamente com a idade', () => {
    let anterior = Infinity;
    for (const idade of [10, 20, 40, 60, 80, 90]) {
      const atual = macNaIdade('sevoflurano', idade);
      expect(atual).toBeLessThan(anterior);
      anterior = atual;
    }
  });

  it('dos 40 aos 80 a CAM cai ~22%, que é o motivo de o card existir', () => {
    const queda = 1 - macNaIdade('sevoflurano', 80) / macNaIdade('sevoflurano', 40);
    expect(queda * 100).toBeCloseTo(21.9, 0);
  });

  it('agente desconhecido ou idade inválida → null', () => {
    expect(macNaIdade('inexistente', 40)).toBeNull();
    expect(macNaIdade('sevoflurano', NaN)).toBeNull();
  });
});

describe('faixa em que a reta não foi validada', () => {
  it.each([
    [0.5, 'lactente'],
    [3, 'pre_escolar'],
    [100, 'muito_idoso'],
  ])('idade %s → %s', (idade, motivo) => {
    expect(idadeForaDaValidacao(idade)).toBe(motivo);
  });

  it('entre 5 e 95 anos não avisa nada', () => {
    for (const idade of [5, 18, 40, 70, 95]) {
      expect(idadeForaDaValidacao(idade)).toBeNull();
    }
  });
});

describe('fração de CAM total — vapor + N₂O somam', () => {
  it('1 CAM de sevoflurano puro na idade dá total 1,0', () => {
    const r = fracaoMacTotal({ agente: 'sevoflurano', idadeAnos: 80, vaporPercent: macNaIdade('sevoflurano', 80) });
    expect(r.total).toBeCloseTo(1, 6);
    expect(r.fracaoN2O).toBe(0);
  });

  it('sevo 1,0% com N₂O 60% aos 80 anos → total 1,45 CAM', () => {
    const r = fracaoMacTotal({ agente: 'sevoflurano', idadeAnos: 80, vaporPercent: 1.0, n2oPercent: 60 });
    expect(r.macVapor).toBeCloseTo(1.405, 2);
    expect(r.macN2O).toBeCloseTo(81.18, 1);
    expect(r.fracaoVapor).toBeCloseTo(0.712, 2);
    expect(r.fracaoN2O).toBeCloseTo(0.739, 2);
    expect(r.total).toBeCloseTo(1.451, 2);
  });

  it('o N₂O também é corrigido pela idade, não fica em 104', () => {
    expect(fracaoMacTotal({ agente: 'sevoflurano', idadeAnos: 20, vaporPercent: 1 }).macN2O)
      .toBeCloseTo(117.7, 0);
  });

  it('com N₂O, o vapor precisa cobrir só o que falta para 1 CAM', () => {
    const r = fracaoMacTotal({ agente: 'sevoflurano', idadeAnos: 80, vaporPercent: 1.0, n2oPercent: 60 });
    expect(r.vaporPara1MacComN2O).toBeCloseTo(0.367, 2);
    // Conferência: usar esse vapor com o mesmo N₂O dá exatamente 1 CAM.
    const conferencia = fracaoMacTotal({
      agente: 'sevoflurano', idadeAnos: 80,
      vaporPercent: r.vaporPara1MacComN2O, n2oPercent: 60,
    });
    expect(conferencia.total).toBeCloseTo(1, 6);
  });

  it('N₂O sozinho, sem vapor, ainda dá fração', () => {
    const r = fracaoMacTotal({ agente: 'sevoflurano', idadeAnos: 40, vaporPercent: 0, n2oPercent: 70 });
    expect(r.fracaoVapor).toBe(0);
    expect(r.total).toBeCloseTo(70 / 104, 4);
  });

  it('N₂O suficiente para 1 CAM sozinho zera o vapor necessário, sem negativo', () => {
    const r = fracaoMacTotal({ agente: 'sevoflurano', idadeAnos: 80, vaporPercent: 0, n2oPercent: 100 });
    expect(r.vaporPara1MacComN2O).toBe(0);
  });
});
