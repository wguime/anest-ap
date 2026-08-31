/**
 * Trava estrutural: nenhuma opção de select pode deixar a calculadora muda.
 *
 * Origem (30/08/2026): `ped_jejum` tinha `value: 'liquido_claro'` no select e
 * `líquido_claro` como chave do mapa. O acesso devolvia `undefined`, o `compute`
 * lançava `TypeError`, e o `catch { setResult(null) }` de
 * `CalculatorShowcase.jsx:1974` engolia — a opção mais escolhida do card não
 * mostrava resultado nenhum, sem erro em lugar nenhum.
 *
 * O teste de cada card só pega o card que alguém lembrou de testar. Este pega a
 * CLASSE do defeito em todas as calculadoras ativas de uma vez.
 *
 * ⚠️ Limite honesto deste arquivo: ele pega opção que faz o `compute` LANÇAR.
 * Não pega opção que cai num fallback cujo valor por acaso coincide com o certo
 * — foi o caso de `crianca`/`criança` em `ped_mabl` e `ped_perdas_sang`, que
 * dava 75 mL/kg pelos dois caminhos. Para essa classe, a trava é o bloco de
 * volemia declarada no fim deste arquivo.
 */
import { describe, it, expect } from 'vitest';
import { getActiveCalculators, getCalculatorById } from '../../design-system/data/calculator-definitions.js';

const comSelect = getActiveCalculators()
  .filter((c) => typeof c.compute === 'function')
  .flatMap((c) =>
    (c.inputs || [])
      .filter((i) => i.type === 'select' && Array.isArray(i.options))
      .flatMap((i) => i.options.map((o) => [c.id, i.id, o.value])),
  );

describe('nenhuma opção de select derruba o compute', () => {
  it('há opções de select para testar', () => {
    expect(comSelect.length).toBeGreaterThan(20);
  });

  it.each(comSelect)('%s · %s = "%s" não lança', (calcId, inputId, value) => {
    const calc = getCalculatorById(calcId);
    // Só o campo do select. O compute pode legitimamente devolver `null` por
    // falta dos numéricos — o que ele não pode é LANÇAR.
    expect(() => calc.compute({ [inputId]: value })).not.toThrow();
  });

  it.each(comSelect)('%s · %s = "%s" não lança junto com os numéricos', (calcId, inputId, value) => {
    const calc = getCalculatorById(calcId);
    // Preenche todo campo numérico com um valor plausível dentro do `min`/`max`,
    // para exercitar o caminho completo do compute.
    const preenchido = { [inputId]: value };
    for (const input of calc.inputs || []) {
      if (input.id === inputId) continue;
      if (input.type === 'number') {
        const min = Number.isFinite(input.min) ? input.min : 1;
        const max = Number.isFinite(input.max) ? input.max : 100;
        preenchido[input.id] = Math.min(max, Math.max(min, 10));
      } else if (input.type === 'bool') {
        preenchido[input.id] = false;
      } else if (input.type === 'select' && Array.isArray(input.options)) {
        preenchido[input.id] = input.options[0].value;
      }
    }
    expect(() => calc.compute(preenchido)).not.toThrow();
  });
});

describe('volemia por faixa etária: o rótulo e a conta dizem o mesmo', () => {
  // Se a chave do mapa deixar de casar com o `value` da opção, a conta cai num
  // fallback e passa a contradizer o rótulo que a própria opção exibe.
  it.each(['ped_mabl', 'ped_perdas_sang'])('%s', (id) => {
    const calc = getCalculatorById(id);
    const faixas = calc.inputs.find((i) => i.id === 'faixaEtaria').options;

    for (const faixa of faixas) {
      const declarado = Number(faixa.label.match(/(\d+)\s*mL\/kg/)[1]);
      const r = calc.compute({
        faixaEtaria: faixa.value,
        peso: 10,
        hematocritoInicial: 40,
        hematocritoMinimo: 25,
        perdaEstimada: 100,
      });
      const usado = Number(r.details['Volemia estimada'].match(/\((\d+) mL\/kg\)/)[1]);
      expect(usado, `${id} · ${faixa.label}: rótulo diz ${declarado}, conta usa ${usado}`).toBe(declarado);
    }
  });
});
