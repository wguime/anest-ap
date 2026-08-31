/**
 * Travas dos 7 cards acrescentados e do `ped_parkland` corrigido em 30/08/2026,
 * conforme `docs/auditoria-calculadoras-uso-real.md` §7 e §8.5.
 *
 * As libs puras (`pesoCorporal`, `anestesicoLocal`, `correcaoSodio`, `macIdade`)
 * têm testes próprios em `src/__tests__/lib/`. Aqui se testa a LIGAÇÃO: se o
 * `value` de cada select chega à chave certa da lib, e se o card devolve o
 * número que a diretriz manda. É exatamente onde nasceram os defeitos de
 * `ped_jejum` e `ped_mabl`.
 */
import { describe, it, expect } from 'vitest';
import { getCalculatorById } from '../../design-system/data/calculator-definitions.js';

const card = (id) => getCalculatorById(id);
const calc = (id, values) => card(id).compute(values);
const opcoes = (id, inputId) => card(id).inputs.find((i) => i.id === inputId).options.map((o) => o.value);

describe('ped_parkland — a constante pediátrica é 3 mL/kg/%SCQ, não 2', () => {
  // A ABA Clinical Practice Guideline de 2024 recomenda 2 mL/kg/%SCQ e declara
  // escopo de ADULTOS com queimadura >= 20% SCQ. Para criança, o curso ABLS da
  // própria ABA usa 3 mL/kg/%SCQ somado à manutenção.
  it('20 kg com 30% de SCQ → 1800 mL de reposição (3 × 20 × 30)', () => {
    const r = calc('ped_parkland', { peso: 20, scq: 30, horasDesdeQueimadura: 0 });
    expect(r.details['Parkland (reposição)']).toContain('1800');
  });

  it('a manutenção continua somada abaixo de 30 kg', () => {
    const r = calc('ped_parkland', { peso: 20, scq: 30, horasDesdeQueimadura: 0 });
    // Holliday-Segar diário para 20 kg = 1000 + 10×50 = 1500 mL.
    expect(r.details['Manutenção (Holliday-Segar)']).toContain('1500');
    expect(r.score).toBeCloseTo(1800 + 1500, 0);
  });

  it('acima de 30 kg não soma manutenção — é só a reposição', () => {
    const r = calc('ped_parkland', { peso: 40, scq: 20, horasDesdeQueimadura: 0 });
    expect(r.score).toBeCloseTo(3 * 40 * 20, 0);
    expect(r.details['Manutenção (Holliday-Segar)']).toContain('Não necessário');
  });

  it('o texto do card não promete mais a constante de adulto', () => {
    const kp = card('ped_parkland').infoBox.keyPoints.join(' | ');
    expect(kp).toContain('3 mL');
    expect(kp).toContain('ADULTO');
  });
});

describe('risco_dasi — pesos originais de Hlatky', () => {
  it('todas as respostas "sim" somam 58,20', () => {
    const tudo = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`q${i + 1}`, true]),
    );
    expect(calc('risco_dasi', tudo).score).toBeCloseTo(58.2, 2);
  });

  it('nenhuma resposta → 0 pontos e VO₂ de repouso 9,6', () => {
    const r = calc('risco_dasi', { q1: false });
    expect(r.score).toBe(0);
    expect(r.details['VO₂ pico estimado']).toContain('9,6');
  });

  it.each([
    ['q1', 2.75], ['q2', 1.75], ['q4', 5.5], ['q5', 8], ['q6', 2.7],
    ['q8', 8], ['q10', 5.25], ['q12', 7.5],
  ])('%s vale %s pontos', (campo, peso) => {
    expect(calc('risco_dasi', { [campo]: true }).score).toBeCloseTo(peso, 2);
  });

  it('DASI 58,2 → 34,6 mL/kg/min e ~9,9 METs, risco baixo', () => {
    const tudo = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`q${i + 1}`, true]));
    const r = calc('risco_dasi', tudo);
    expect(r.details['VO₂ pico estimado']).toContain('34,6');
    expect(r.details['Equivalente metabólico']).toContain('9,9');
    expect(r.risk).toBe('baixo');
  });

  it('o corte de 34 separa baixo de reduzido', () => {
    // q5 + q8 + q12 + q11 + q10 = 8 + 8 + 7,5 + 6 + 5,25 = 34,75
    const acima = calc('risco_dasi', { q5: true, q8: true, q12: true, q11: true, q10: true });
    expect(acima.score).toBeGreaterThanOrEqual(34);
    expect(acima.risk).toBe('baixo');
  });

  it('menos de 4 METs é risco alto — o corte do ACC/AHA', () => {
    // 4 METs = VO2 14 → DASI ~10,2. Só q1 + q2 = 4,5 fica bem abaixo.
    const r = calc('risco_dasi', { q1: true, q2: true });
    expect(r.risk).toBe('alto');
    expect(r.details['Leitura']).toContain('4 METs');
  });

  it('entre 4 METs e DASI 34 o risco é intermediário', () => {
    // q1+q2+q3+q4+q6+q7 = 2,75+1,75+2,75+5,5+2,7+3,5 = 18,95 → VO2 17,75 → 5,1 METs
    const r = calc('risco_dasi', { q1: true, q2: true, q3: true, q4: true, q6: true, q7: true });
    expect(r.score).toBeLessThan(34);
    expect(r.risk).toBe('medio');
  });
});

describe('periop_4at — pontuação e leitura', () => {
  it('todas as opções do select estão no mapa de pontos (sem chave órfã)', () => {
    for (const campo of ['alerta', 'amt4', 'atencao', 'mudanca']) {
      for (const valor of opcoes('periop_4at', campo)) {
        const r = calc('periop_4at', { [campo]: valor });
        expect(r, `${campo}=${valor} não pontuou`).toBeTruthy();
        expect(Number.isFinite(r.score), `${campo}=${valor} sem score`).toBe(true);
      }
    }
  });

  it('paciente normal em tudo → 0/12, delirium improvável', () => {
    const r = calc('periop_4at', {
      alerta: 'alerta_normal', amt4: 'amt4_zero',
      atencao: 'atencao_sete', mudanca: 'mudanca_nao',
    });
    expect(r.score).toBe(0);
    expect(r.risk).toBe('baixo');
  });

  it('alerta claramente anormal sozinho já dá 4 → delirium provável', () => {
    const r = calc('periop_4at', { alerta: 'alerta_anormal' });
    expect(r.score).toBe(4);
    expect(r.risk).toBe('alto');
    expect(r.details['Leitura']).toContain('provável');
  });

  it('mudança aguda sozinha também dá 4', () => {
    expect(calc('periop_4at', { mudanca: 'mudanca_sim' }).score).toBe(4);
  });

  it('sonolência leve NÃO pontua — é o distrator do item 1', () => {
    expect(calc('periop_4at', { alerta: 'alerta_sonolencia_leve' }).score).toBe(0);
  });

  it('1 a 3 pontos é a faixa intermediária', () => {
    const r = calc('periop_4at', { amt4: 'amt4_um', atencao: 'atencao_parcial' });
    expect(r.score).toBe(2);
    expect(r.risk).toBe('medio');
  });

  it('o máximo é 12', () => {
    const r = calc('periop_4at', {
      alerta: 'alerta_anormal', amt4: 'amt4_dois',
      atencao: 'atencao_intestavel', mudanca: 'mudanca_sim',
    });
    expect(r.score).toBe(12);
  });

  it('a licença CC BY 4.0 é creditada, como o CC BY exige', () => {
    expect(card('periop_4at').infoBox.reference).toContain('CC BY 4.0');
  });
});

describe('periop_jejum_adulto — a lição do ped_jejum não se repete', () => {
  it('toda opção devolve resultado, sem chave órfã', () => {
    for (const valor of opcoes('periop_jejum_adulto', 'tipo_alimento')) {
      const r = calc('periop_jejum_adulto', { tipo_alimento: valor });
      expect(r, `${valor} não devolveu resultado`).toBeTruthy();
      expect(Number.isFinite(r.score), `${valor} sem score`).toBe(true);
    }
  });

  it.each([
    ['liquido_claro', 2],
    ['carboidrato', 2],
    ['leite_nao_humano', 6],
    ['refeicao_leve', 6],
    ['refeicao_gordurosa', 8],
    ['goma_mascar', 0],
  ])('%s → %i h', (valor, horas) => {
    expect(calc('periop_jejum_adulto', { tipo_alimento: valor }).score).toBe(horas);
  });

  it('a frase do resultado nunca mostra "undefined"', () => {
    const c = card('periop_jejum_adulto');
    for (const valor of opcoes('periop_jejum_adulto', 'tipo_alimento')) {
      expect(c.resultMessage(calc('periop_jejum_adulto', { tipo_alimento: valor }))).not.toContain('undefined');
    }
  });

  it('a goma de mascar não adia a cirurgia (ASA 2023)', () => {
    const r = calc('periop_jejum_adulto', { tipo_alimento: 'goma_mascar' });
    expect(r.details['Tempo mínimo']).toContain('Não adia');
  });

  it('o carboidrato traz o limite de 400 mL', () => {
    expect(calc('periop_jejum_adulto', { tipo_alimento: 'carboidrato' }).details['Observação']).toContain('400');
  });
});

describe('periop_mac — ligação com a lib', () => {
  it('todo agente do select existe na lib', () => {
    for (const agente of opcoes('periop_mac', 'agente')) {
      const r = calc('periop_mac', { agente, idade: 40, vapor: 1 });
      expect(r, `${agente} não calculou`).toBeTruthy();
    }
  });

  it('sevoflurano aos 80 anos mostra 1,40% contra 1,80% aos 40', () => {
    const r = calc('periop_mac', { agente: 'sevoflurano', idade: 80 });
    expect(r.details['CAM nesta idade']).toContain('1,40');
    expect(r.details['CAM nesta idade']).toContain('1,80');
  });

  it('sevo 1,0% com N₂O 60% aos 80 anos → CAM total 1,45', () => {
    const r = calc('periop_mac', { agente: 'sevoflurano', idade: 80, vapor: 1, n2o: 60 });
    expect(r.details['CAM total']).toContain('1,45');
  });

  it('o zero digitado no N₂O é respeitado — não vira padrão', () => {
    const semN2O = calc('periop_mac', { agente: 'sevoflurano', idade: 80, vapor: 1, n2o: 0 });
    expect(semN2O.details['Fração do N₂O']).toBeUndefined();
    expect(semN2O.details['CAM total']).toContain('0,71');
  });

  it('abaixo de 0,7 CAM o card avisa do risco de despertar', () => {
    const r = calc('periop_mac', { agente: 'sevoflurano', idade: 40, vapor: 0.9 });
    expect(r.risk).toBe('alto');
    expect(r.details['CAM total']).toContain('despertar');
  });

  it('lactente recebe o aviso de que a reta não vale ali', () => {
    const r = calc('periop_mac', { agente: 'sevoflurano', idade: 0.5, vapor: 2 });
    expect(r.details['Atenção']).toContain('PICO');
  });

  it('sem idade não calcula — é a variável que dá sentido ao card', () => {
    expect(calc('periop_mac', { agente: 'sevoflurano', vapor: 1 })).toBeNull();
  });
});

describe('renal_correcao_sodio — ligação com a lib', () => {
  const base = { na_atual: 120, na_alvo: 128, peso: 70, perfil: 'homem_adulto', solucao: 'salina3' };

  it('todo perfil e toda solução do select existem na lib', () => {
    for (const perfil of opcoes('renal_correcao_sodio', 'perfil')) {
      for (const solucao of opcoes('renal_correcao_sodio', 'solucao')) {
        const r = calc('renal_correcao_sodio', { ...base, perfil, solucao });
        expect(r, `${perfil} + ${solucao} não calculou`).toBeTruthy();
      }
    }
  });

  it('120 → 128 com salina 3% em homem de 70 kg → ~875 mL a ~36 mL/h', () => {
    const r = calc('renal_correcao_sodio', base);
    expect(r.details['Volume em 24 h']).toContain('875');
    expect(r.details['Velocidade']).toContain('36');
    expect(r.risk).toBe('baixo');
  });

  it('pedir 12 mmol/L em 24 h dispara o alerta de teto', () => {
    const r = calc('renal_correcao_sodio', { ...base, na_alvo: 132 });
    expect(r.risk).toBe('critico');
    expect(r.details['⚠️ Acima do teto']).toBeTruthy();
  });

  it('solução no sentido errado é apontada, não calculada em silêncio', () => {
    const r = calc('renal_correcao_sodio', { ...base, solucao: 'glicosado5' });
    expect(r.risk).toBe('alto');
    expect(r.details['Problema']).toContain('OPOSTO');
    expect(r.details['Volume em 24 h']).toBeUndefined();
  });

  it('hipernatremia: 165 → 158 com glicose 5% tem resposta', () => {
    const r = calc('renal_correcao_sodio', {
      na_atual: 165, na_alvo: 158, peso: 70, perfil: 'homem_adulto', solucao: 'glicosado5',
    });
    expect(r.details['Volume em 24 h']).toBeTruthy();
    expect(r.details['Teto recomendado']).toContain('10');
  });

  it('alto risco aperta o teto e diz por quê', () => {
    const r = calc('renal_correcao_sodio', { ...base, na_alvo: 130, alto_risco: true });
    expect(r.details['Teto recomendado']).toContain('8');
  });
});

describe('dor_peso_dose e dor_anestesico_local — ligação com a lib', () => {
  it('peso magro de homem 100 kg / 175 cm é o número em destaque', () => {
    const r = calc('dor_peso_dose', { sexo: 'masculino', peso: 100, altura: 175 });
    expect(r.score).toBeCloseTo(67.5, 1);
    expect(r.details['IMC']).toContain('Obesidade grau I');
  });

  it('abaixo de 152 cm o card diz que a Devine não se aplica, sem inventar número', () => {
    const r = calc('dor_peso_dose', { sexo: 'feminino', peso: 45, altura: 145 });
    expect(r.details['Peso ideal (IBW)']).toContain('não se aplica');
    expect(r.score).toBeGreaterThan(0);
  });

  it('é conta pura — sem badge de risco', () => {
    expect(calc('dor_peso_dose', { sexo: 'masculino', peso: 70, altura: 175 }).risk).toBeUndefined();
  });

  it('todo fármaco do select existe na tabela da lib', () => {
    for (const farmaco of opcoes('dor_anestesico_local', 'farmaco')) {
      const r = calc('dor_anestesico_local', { farmaco, peso: 70, concentracao: 1 });
      expect(r, `${farmaco} não calculou`).toBeTruthy();
    }
  });

  it('lidocaína 2% sem adrenalina em 70 kg → 315 mg e 15,8 mL', () => {
    const r = calc('dor_anestesico_local', { farmaco: 'lidocaina', peso: 70, concentracao: 2 });
    expect(r.score).toBeCloseTo(315, 0);
    expect(r.details['Volume máximo']).toContain('15,8');
  });

  it('o teto absoluto aparece na tela quando ele é que manda', () => {
    const r = calc('dor_anestesico_local', {
      farmaco: 'lidocaina', peso: 100, concentracao: 2, vasoconstritor: true,
    });
    expect(r.score).toBe(500);
    expect(r.details['Teto absoluto']).toContain('700');
  });

  it('sem concentração, a dose em mg ainda sai', () => {
    const r = calc('dor_anestesico_local', { farmaco: 'bupivacaina', peso: 70 });
    expect(r.score).toBeCloseTo(175, 0);
    expect(r.details['Volume máximo']).toBeUndefined();
  });
});

describe('todos os cards novos declaram fonte primária', () => {
  it.each([
    'dor_peso_dose', 'dor_anestesico_local', 'periop_jejum_adulto',
    'periop_4at', 'periop_mac', 'renal_correcao_sodio', 'risco_dasi',
  ])('%s tem interpretation e reference', (id) => {
    const c = card(id);
    expect(c.status).toBe('active');
    expect(c.infoBox?.reference, `${id} sem referência`).toBeTruthy();
    expect(c.infoBox?.interpretation, `${id} sem interpretação`).toBeTruthy();
  });
});
