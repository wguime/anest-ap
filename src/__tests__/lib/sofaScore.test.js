import { describe, it, expect } from 'vitest';
import { qsofa, sofa, sofaCompare } from '@/lib/sofaScore';

// ============================================================================
// qSOFA
// ============================================================================

describe('qsofa', () => {
  it('all false = score 0, baixo', () => {
    const r = qsofa({ altMental: false, frAlta: false, pasBaixa: false });
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(3);
    expect(r.version).toBe('qsofa');
    expect(r.risk).toBe('baixo');
    expect(r.interpretation).toBe('Baixo risco');
  });

  it('2/3 criteria = score 2, alto', () => {
    const r = qsofa({ altMental: true, frAlta: true, pasBaixa: false });
    expect(r.score).toBe(2);
    expect(r.risk).toBe('alto');
    expect(r.interpretation).toContain('Alto risco');
    expect(r.interpretation).toContain('SOFA completo');
  });

  it('3/3 criteria = score 3, alto', () => {
    const r = qsofa({ altMental: true, frAlta: true, pasBaixa: true });
    expect(r.score).toBe(3);
    expect(r.risk).toBe('alto');
  });

  it('score 1 = medio', () => {
    const r = qsofa({ altMental: false, frAlta: true, pasBaixa: false });
    expect(r.score).toBe(1);
    expect(r.risk).toBe('medio');
    expect(r.interpretation).toContain('intermediário');
  });

  it('null/undefined input returns null', () => {
    expect(qsofa(null)).toBeNull();
    expect(qsofa(undefined)).toBeNull();
    expect(qsofa({})).toBeNull();
  });
});

// ============================================================================
// SOFA
// ============================================================================

describe('sofa', () => {
  it('all systems score 0 = total 0, mortality <5%', () => {
    const r = sofa({
      pf: 450,
      vm: false,
      plaquetas: 200,
      bilirrubina: 0.5,
      pam: 80,
      vasopressor: 'nenhum',
      glasgow: 15,
      creatinina: 0.8,
    });
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(24);
    expect(r.version).toBe('sofa');
    expect(r.mortality).toBe('<5%');
    expect(r.risk).toBe('baixo');
    expect(r.organScores).toEqual({
      resp: 0,
      coag: 0,
      hepatic: 0,
      cardio: 0,
      neuro: 0,
      renal: 0,
    });
  });

  it('all systems score 4 = total 24, mortality >80%, critico', () => {
    const r = sofa({
      pf: 50,
      vm: true,
      plaquetas: 10,
      bilirrubina: 14,
      pam: 50,
      vasopressor: 'noraAdre_alta',
      glasgow: 4,
      creatinina: 5.5,
    });
    expect(r.score).toBe(24);
    expect(r.mortality).toBe('>80%');
    expect(r.risk).toBe('critico');
    expect(r.organScores).toEqual({
      resp: 4,
      coag: 4,
      hepatic: 4,
      cardio: 4,
      neuro: 4,
      renal: 4,
    });
  });

  it('mixed scores (1,2,0,3,1,2) = 9, medio', () => {
    const r = sofa({
      pf: 350,      // resp = 1
      vm: false,
      plaquetas: 75, // coag = 2
      bilirrubina: 0.5, // hepatic = 0
      pam: 60,       // cardio base = 1, with vasopressor = 3
      vasopressor: 'dopaAlta', // cardio = 3
      glasgow: 14,   // neuro = 1
      creatinina: 2.5, // renal = 2
    });
    expect(r.score).toBe(9);
    expect(r.risk).toBe('medio');
    expect(r.organScores.resp).toBe(1);
    expect(r.organScores.coag).toBe(2);
    expect(r.organScores.hepatic).toBe(0);
    expect(r.organScores.cardio).toBe(3);
    expect(r.organScores.neuro).toBe(1);
    expect(r.organScores.renal).toBe(2);
  });

  it('returns organScores object with all 6 keys', () => {
    const r = sofa({
      pf: 400,
      vm: false,
      plaquetas: 150,
      bilirrubina: 1.0,
      pam: 75,
      vasopressor: 'nenhum',
      glasgow: 15,
      creatinina: 1.0,
    });
    expect(r.organScores).toBeDefined();
    expect(Object.keys(r.organScores)).toHaveLength(6);
    expect(r.organScores).toHaveProperty('resp');
    expect(r.organScores).toHaveProperty('coag');
    expect(r.organScores).toHaveProperty('hepatic');
    expect(r.organScores).toHaveProperty('cardio');
    expect(r.organScores).toHaveProperty('neuro');
    expect(r.organScores).toHaveProperty('renal');
  });

  it('null/undefined input returns null', () => {
    expect(sofa(null)).toBeNull();
    expect(sofa(undefined)).toBeNull();
    expect(sofa({})).toBeNull();
  });

  it('interpretation mentions Sepsis-3', () => {
    const r = sofa({
      pf: 250,
      vm: false,
      plaquetas: 120,
      bilirrubina: 1.5,
      pam: 65,
      vasopressor: 'nenhum',
      glasgow: 14,
      creatinina: 1.5,
    });
    expect(r.interpretation).toContain('Sepsis-3');
    expect(r.interpretation).toContain('aumento ≥2 pts');
  });

  it('boundary: SOFA score 12 = alto (40-50%)', () => {
    // Construct a case that sums to 12: resp=4, coag=4, hepatic=4, rest=0
    const r = sofa({
      pf: 50,
      vm: true,
      plaquetas: 10,
      bilirrubina: 14,
      pam: 80,
      vasopressor: 'nenhum',
      glasgow: 15,
      creatinina: 0.8,
    });
    expect(r.score).toBe(12);
    expect(r.risk).toBe('alto');
    expect(r.mortality).toBe('40-50%');
  });

  it('boundary: SOFA score 13 = alto (55-70%)', () => {
    // resp=4, coag=4, hepatic=4, neuro=1 = 13
    const r = sofa({
      pf: 50,
      vm: true,
      plaquetas: 10,
      bilirrubina: 14,
      pam: 80,
      vasopressor: 'nenhum',
      glasgow: 14,   // neuro = 1
      creatinina: 0.8,
    });
    expect(r.score).toBe(13);
    expect(r.risk).toBe('alto');
    expect(r.mortality).toBe('55-70%');
  });
});

// ============================================================================
// sofaCompare
// ============================================================================

describe('sofaCompare', () => {
  it('returns both qsofa and sofa results', () => {
    const result = sofaCompare({
      // qSOFA fields
      altMental: true,
      frAlta: true,
      pasBaixa: false,
      // SOFA fields
      pf: 350,
      vm: false,
      plaquetas: 120,
      bilirrubina: 1.5,
      pam: 65,
      vasopressor: 'nenhum',
      glasgow: 14,
      creatinina: 1.5,
    });
    expect(result.qsofa).not.toBeNull();
    expect(result.sofa).not.toBeNull();
    expect(result.qsofa.version).toBe('qsofa');
    expect(result.sofa.version).toBe('sofa');
  });

  it('null input returns both null', () => {
    const result = sofaCompare(null);
    expect(result.qsofa).toBeNull();
    expect(result.sofa).toBeNull();
  });
});

// ============================================================================
// Edge cases — organ scoring functions
// ============================================================================

describe('organ scoring edge cases', () => {
  it('respiratory: PaO2/FiO2 < 100 without VM caps at score 2', () => {
    // PF < 100 but no VM => score 2 (not 3 or 4)
    const r = sofa({
      pf: 80,
      vm: false,
      plaquetas: 200,
      bilirrubina: 0.5,
      pam: 80,
      vasopressor: 'nenhum',
      glasgow: 15,
      creatinina: 0.8,
    });
    expect(r.organScores.resp).toBe(2);
  });

  it('cardiovascular: vasopressor takes precedence over PAM', () => {
    // PAM >= 70 but on noraAdre_alta => score 4 (not 0)
    const r = sofa({
      pf: 450,
      vm: false,
      plaquetas: 200,
      bilirrubina: 0.5,
      pam: 80,
      vasopressor: 'noraAdre_alta',
      glasgow: 15,
      creatinina: 0.8,
    });
    expect(r.organScores.cardio).toBe(4);
  });

  it('renal: diureseDay < 200 overrides creatinine score', () => {
    // Cr = 0.8 would be score 0, but DU < 200 => score 4
    const r = sofa({
      pf: 450,
      vm: false,
      plaquetas: 200,
      bilirrubina: 0.5,
      pam: 80,
      vasopressor: 'nenhum',
      glasgow: 15,
      creatinina: 0.8,
      diureseDay: 150,
    });
    expect(r.organScores.renal).toBe(4);
  });

  it('neurological: GCS boundary 13 = score 1, GCS 12 = score 2', () => {
    const r1 = sofa({
      pf: 450, vm: false, plaquetas: 200, bilirrubina: 0.5,
      pam: 80, vasopressor: 'nenhum', glasgow: 13, creatinina: 0.8,
    });
    expect(r1.organScores.neuro).toBe(1);

    const r2 = sofa({
      pf: 450, vm: false, plaquetas: 200, bilirrubina: 0.5,
      pam: 80, vasopressor: 'nenhum', glasgow: 12, creatinina: 0.8,
    });
    expect(r2.organScores.neuro).toBe(2);
  });
});
