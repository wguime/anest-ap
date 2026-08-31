/**
 * Trava do jejum pré-operatório pediátrico (`ped_jejum`).
 *
 * Defeito que originou o arquivo (30/08/2026): o `value` da opção era
 * `'liquido_claro'` (sem acento) e a chave do mapa `TEMPOS_JEJUM` era
 * `'líquido_claro'` (com acento). `TEMPOS_JEJUM[tipo]` voltava `undefined`,
 * `info.horas` lançava `TypeError`, e o `catch { setResult(null) }` de
 * `CalculatorShowcase.jsx:1974` engolia a exceção.
 *
 * Na tela: escolher "Líquidos claros" — a pergunta de jejum que mais se faz —
 * não mostrava resultado nenhum. As outras 5 opções funcionavam.
 *
 * Segundo defeito, do mesmo tipo, na mesma tela: `resultMessage` lia
 * `details['Tempo minimo']` (sem acento) e a chave gravada era
 * `'Tempo mínimo'`, então a frase saía "Jejum mínimo: undefined para ...".
 *
 * Fonte dos tempos: ASA Practice Guidelines 2023 (modular update) | ESAIC 2022
 * e SPA/ADARPEF, que toleram 1 h para líquidos claros em crianças.
 */
import { describe, it, expect } from 'vitest';
import { getCalculatorById } from '../../design-system/data/calculator-definitions.js';

const card = getCalculatorById('ped_jejum');
const jejum = card.compute;
const opcoes = card.inputs.find((i) => i.id === 'tipo_alimento').options;

describe('toda opção do select devolve um resultado', () => {
  it('são as 6 opções esperadas', () => {
    expect(opcoes.map((o) => o.value)).toEqual([
      'liquido_claro', 'leite_materno', 'formula', 'leite_vaca', 'leve', 'gordurosa',
    ]);
  });

  it.each(opcoes.map((o) => [o.value, o.label]))(
    '%s ("%s") não volta vazio nem lança',
    (value) => {
      const r = jejum({ tipo_alimento: value });
      expect(r, `${value} não devolveu resultado`).toBeTruthy();
      expect(Number.isFinite(r.score), `${value} sem score numérico`).toBe(true);
      expect(r.score).toBeGreaterThan(0);
    },
  );

  it('sem seleção continua devolvendo null', () => {
    expect(jejum({})).toBeNull();
  });
});

describe('os tempos são os das diretrizes', () => {
  it.each([
    ['liquido_claro', 2],
    ['leite_materno', 4],
    ['formula', 6],
    ['leite_vaca', 6],
    ['leve', 6],
    ['gordurosa', 8],
  ])('%s → %i h', (value, horas) => {
    expect(jejum({ tipo_alimento: value }).score).toBe(horas);
  });
});

describe('a frase do resultado não mostra "undefined"', () => {
  it.each(opcoes.map((o) => o.value))('%s', (value) => {
    const frase = card.resultMessage(jejum({ tipo_alimento: value }));
    expect(frase).not.toContain('undefined');
    expect(frase).toContain('horas');
  });
});
