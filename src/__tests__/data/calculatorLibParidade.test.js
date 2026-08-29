/**
 * Trava: as calculadoras que TÊM lib em `src/lib/` devem entregar a conta certa.
 *
 * Contexto (levantamento 27/08/2026). Cinco libs tinham teste e ZERO importador
 * fora do próprio teste — `apacheII`, `curb65`, `fourScore`, `roxIndex` e
 * `electrolyteCorrection`. As calculadoras equivalentes calculavam inline em
 * `calculator-definitions.js`. A suíte ficava verde sem cobrir a matemática que
 * roda em produção, e as duas implementações puderam divergir sem nada acusar.
 * Comparadas por varredura, tinham divergido mesmo:
 *
 *   - APACHE II: o inline usava `parseFloat(x) || default`, que descarta o ZERO
 *     como se fosse campo vazio. FR = 0 (apneia) e leucócitos = 0 são valores
 *     clínicos legítimos — os inputs têm `min: 0` — e valem +4 cada. A produção
 *     dava 0. Até 8 pontos de APACHE II sumiam em silêncio.
 *   - Eletrólitos: a lib cortava as faixas em INTEIRO (`<= 129`, `<= 8.4`) sobre
 *     um valor que é quase sempre fracionário, e não tinha a faixa de crise
 *     hipercalcêmica. Aqui quem estava certa era a produção.
 *   - FOUR Score: B0 e B1 tinham o MESMO texto nos dois lados. Na escala
 *     original, B0 é "pupilar, corneano E TOSSE ausentes" (o reflexo de tosse
 *     só é testado quando pupilar e corneano já estão ausentes) — sem isso o
 *     usuário não consegue distinguir as duas opções.
 *
 * Estes casos são asserções de VALOR CLÍNICO, não de paridade lib↔inline: depois
 * da unificação, comparar as duas implementações seria comparar a mesma função
 * com ela mesma, e a trava não protegeria nada.
 *
 * Fontes: Knaus WA et al. Crit Care Med 1985;13(10):818-29 (APACHE II) |
 * Wijdicks EFM et al. Ann Neurol 2005;58(4):585-93 (FOUR Score) |
 * Roca O et al. J Crit Care 2016;35:200-5 (ROX) |
 * Hillier TA et al. Am J Med 1999 + Payne RB et al. BMJ 1973 (eletrólitos).
 */
import { describe, it, expect } from 'vitest';
import { getAllCalculators } from '../../design-system/data/calculator-definitions.js';

// ⚠️ Busca pelo id BRUTO, não por `getCalculatorById`: desde a triagem de
// 29/08/2026 o `uti_apache2` está `inactive` e o `LEGACY_ID_MAP` o redireciona
// para o `uti_saps3`. Passar pelo resolvedor traria o compute do SAPS III e a
// trava do APACHE II viraria decoração — a calculadora segue no arquivo e pode
// voltar, então a conta dela continua sob teste.
const definicao = (id) => getAllCalculators().find((c) => c.id === id);
const compute = (id) => definicao(id).compute;

// ---------------------------------------------------------------------------
// APACHE II
// ---------------------------------------------------------------------------

// Todos os parâmetros em faixa normal → 0 ponto. Base para isolar uma variável.
const APACHE_NORMAL = {
  idade: 40, temp: 37, pam: 80, fc: 80, fr: 16, oxigenacao: 'pao2_70',
  ph: 7.4, sodio: 140, potassio: 4, creatinina: 1, hematocrito: 40,
  leucocitos: 10, glasgow: 15, doenca_cronica: 'nenhuma',
};

describe('APACHE II — o zero é valor, não campo vazio', () => {
  const apache = compute('uti_apache2');

  it('a base normal pontua 0', () => {
    expect(apache(APACHE_NORMAL).score).toBe(0);
  });

  // O caso que a produção errava: `parseFloat(0) || 16` devolve 16.
  it('FR = 0 (apneia) pontua +4 — o input aceita 0 (min: 0)', () => {
    expect(apache({ ...APACHE_NORMAL, fr: 0 }).score).toBe(4);
  });

  it('leucócitos = 0 pontua +4 — o input aceita 0 (min: 0)', () => {
    expect(apache({ ...APACHE_NORMAL, leucocitos: 0 }).score).toBe(4);
  });

  it('FR = 0 e leucócitos = 0 juntos pontuam +8', () => {
    expect(apache({ ...APACHE_NORMAL, fr: 0, leucocitos: 0 }).score).toBe(8);
  });

  it('caso composto grave soma 46 (Knaus 1985, Tabela 1)', () => {
    const r = apache({
      idade: 70,          // +5
      temp: 39.5,         // +3
      pam: 45,            // +4
      fc: 130,            // +2
      fr: 32,             // +1
      oxigenacao: 'pao2_55', // +4
      ph: 7.2,            // +3
      sodio: 150,         // +1
      potassio: 6.5,      // +3
      creatinina: 2.5, ira: true, // +3 dobrado = +6
      hematocrito: 25,    // +2
      leucocitos: 22,     // +2
      glasgow: 10,        // 15-10 = +5
      doenca_cronica: 'emergencia', // +5
    });
    expect(r.score).toBe(46);
    expect(r.risk).toBe('critico');
  });

  // A Glasgow vale 3 a 15 por construção. O input declara `min: 3`, mas `min` no
  // HTML não impede digitação e o `CalculatorShowcase` não limita o valor — sem
  // trava, um `0` digitado somaria 15 pontos, quase um terço da escala.
  it.each([
    [15, 0],
    [10, 5],
    [3, 12],
    [0, 12],   // abaixo da escala → tratado como 3, não como 15 pontos
    [-5, 12],
    [20, 0],   // acima da escala → tratado como 15
  ])('Glasgow %i soma %i ponto(s)', (glasgow, esperado) => {
    expect(apache({ ...APACHE_NORMAL, glasgow }).score).toBe(esperado);
  });

  it('a creatinina dobra na insuficiência renal aguda', () => {
    const sem = apache({ ...APACHE_NORMAL, creatinina: 3.5 });
    const com = apache({ ...APACHE_NORMAL, creatinina: 3.5, ira: true });
    expect(sem.score).toBe(4);
    expect(com.score).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// FOUR Score
// ---------------------------------------------------------------------------

describe('FOUR Score', () => {
  const four = compute('uti_four_score');
  const inputs = definicao('uti_four_score').inputs;

  it.each([
    [4, 4, 4, 4, 16, 'baixo'],
    [3, 4, 4, 4, 15, 'baixo'],
    [2, 2, 2, 2, 8, 'alto'],
    [1, 1, 1, 1, 4, 'critico'],
    [0, 0, 0, 0, 0, 'critico'],
  ])('E%i M%i B%i R%i → %i (%s)', (eye, motor, brainstem, respiration, total, risk) => {
    const r = four({ eye, motor, brainstem, respiration });
    expect(r.score).toBe(total);
    expect(r.risk).toBe(risk);
  });

  it('B0 e B1 são opções DISTINGUÍVEIS — B0 inclui o reflexo de tosse', () => {
    const brainstem = inputs.find((i) => i.id === 'brainstem');
    const b0 = brainstem.options.find((o) => o.value === 0).label;
    const b1 = brainstem.options.find((o) => o.value === 1).label;

    expect(b0).not.toBe(b1);
    // Wijdicks 2005: B0 = ausência de reflexo pupilar, corneano E de tosse.
    expect(b0.toLowerCase()).toContain('tosse');
    expect(b1.toLowerCase()).not.toContain('tosse');
  });
});

// ---------------------------------------------------------------------------
// CURB-65
// ---------------------------------------------------------------------------

// A `src/lib/curb65.js` foi aposentada (27/08/2026): ela recebia valores BRUTOS
// e aplicava os cortes, enquanto a tela recebe os 5 critérios já avaliados pelo
// clínico — contratos diferentes, e ligar uma na outra mudaria a tela (Regra #2).
// O teste da lib cobria cortes que a produção nunca executou. Estas asserções
// põem sob trava a conta que de fato roda.
describe('CURB-65 — soma dos 5 critérios e a tabela de disposição', () => {
  const curb = compute('uti_curb65');
  const marcar = (n) => {
    const criterios = ['confusion', 'urea', 'rr', 'bp', 'age'];
    return Object.fromEntries(criterios.map((c, i) => [c, i < n]));
  };

  it.each([
    [0, 'baixo', '0,6%', 'Ambulatorial'],
    [1, 'baixo', '2,7%', 'Ambulatorial (considerar internação se outros fatores)'],
    [2, 'medio', '6,8%', 'Internação curta / observação'],
    [3, 'alto', '14%', 'Internação — considerar UTI'],
    [4, 'critico', '27,8%', 'Internação em UTI'],
    [5, 'critico', '57,6%', 'Internação em UTI'],
  ])('%i critério(s) → %s, mortalidade %s', (n, risk, mortalidade, disposicao) => {
    const r = curb(marcar(n));
    expect(r.score).toBe(n);
    expect(r.risk).toBe(risk);
    expect(r.details['Mortalidade em 30 dias']).toBe(mortalidade);
    expect(r.details['Disposição']).toBe(disposicao);
  });

  it('os 5 critérios são os do escore — nenhum a mais, nenhum a menos', () => {
    const ids = definicao('uti_curb65').inputs.map((i) => i.id);
    expect(ids).toEqual(['confusion', 'urea', 'rr', 'bp', 'age']);
  });
});

// ---------------------------------------------------------------------------
// ROX Index
// ---------------------------------------------------------------------------

describe('ROX Index — (SpO2/FiO2) / FR', () => {
  const rox = compute('uti_rox');

  it.each([
    [95, 50, 20, 9.5, 'baixo'],
    [90, 60, 30, 5, 'baixo'],      // exatamente acima do corte 4,88
    [92, 60, 35, 4.38, 'medio'],
    [88, 80, 30, 3.67, 'alto'],
  ])('SpO2 %i / FiO2 %i%% / FR %i → ROX %s (%s)', (spo2, fio2, fr, esperado, risk) => {
    const r = rox({ spo2, fio2, fr });
    expect(r.score).toBeCloseTo(esperado, 2);
    expect(r.risk).toBe(risk);
  });

  it('aceita FiO2 em fração (0,5) e em porcentagem (50) como o mesmo valor', () => {
    expect(rox({ spo2: 95, fio2: 0.5, fr: 20 }).score).toBe(rox({ spo2: 95, fio2: 50, fr: 20 }).score);
  });

  it('devolve null quando falta dado ou o divisor é zero', () => {
    expect(rox({ spo2: 95, fio2: 50 })).toBeNull();
    expect(rox({ spo2: 95, fio2: 50, fr: 0 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Eletrólitos — os cortes de faixa são FRACIONÁRIOS
// ---------------------------------------------------------------------------

describe('Sódio corrigido (Hillier 2,4)', () => {
  const na = compute('renal_sódio');

  it('Na 130 + glicose 70 → 129,28 e a faixa é hiponatremia MODERADA', () => {
    const r = na({ sodio: 130, glicose: 70 });
    expect(r.score).toBeCloseTo(129.28, 2);
    expect(r.risk).toBe('alto');
  });

  it('Na 130 + glicose 300 → 134,80 e a faixa é hiponatremia LEVE', () => {
    const r = na({ sodio: 130, glicose: 300 });
    expect(r.score).toBeCloseTo(134.8, 2);
    expect(r.risk).toBe('medio');
  });

  it('Na 135 + glicose 100 (sem correção) → Normal', () => {
    const r = na({ sodio: 135, glicose: 100 });
    expect(r.score).toBeCloseTo(135, 2);
    expect(r.risk).toBe('baixo');
  });

  it('Na 118 + glicose 100 → hiponatremia grave', () => {
    expect(na({ sodio: 118, glicose: 100 }).risk).toBe('critico');
  });
});

describe('Cálcio corrigido (Payne)', () => {
  const ca = compute('renal_cálcio');

  it('Ca corrigido 8,45 é HIPOCALCEMIA — o corte é 8,5 e não 8,4', () => {
    const r = ca({ calcio: 8.45, albumina: 4 });
    expect(r.score).toBeCloseTo(8.45, 2);
    expect(r.risk).toBe('alto');
  });

  it('Ca 9,0 com albumina normal → Normal', () => {
    expect(ca({ calcio: 9, albumina: 4 }).risk).toBe('baixo');
  });

  it('cada 1 g/dL de albumina abaixo de 4 soma 0,8 mg/dL', () => {
    expect(ca({ calcio: 8, albumina: 2 }).score).toBeCloseTo(9.6, 2);
  });

  it('Ca corrigido acima de 14 é CRISE hipercalcêmica, não apenas hipercalcemia', () => {
    expect(ca({ calcio: 14, albumina: 4 }).risk).toBe('alto');
    expect(ca({ calcio: 15, albumina: 4 }).risk).toBe('critico');
  });
});
