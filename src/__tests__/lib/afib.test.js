import { describe, it, expect } from 'vitest';
import { cha2ds2vasc, hasbled, afibPanel } from '@/lib/afib';

// =============================================================================
// CHA2DS2-VASc
// Ref: Lip GY et al. Chest 2010;137(2):263-272
// Stroke risk %: Lip GY et al. Thromb Haemost 2010;104:1076-1088
// =============================================================================

describe('cha2ds2vasc', () => {
  it('all false = score 0, 0% stroke risk, sem necessidade', () => {
    const r = cha2ds2vasc({});
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(9);
    expect(r.strokeRiskPercent).toBe(0);
    expect(r.recommendation).toBe('Sem necessidade de anticoagulação');
  });

  it('age75 + stroke = score 4, 4.0% risk', () => {
    const r = cha2ds2vasc({ age75: true, stroke: true });
    expect(r.score).toBe(4);
    expect(r.strokeRiskPercent).toBe(4.0);
    expect(r.recommendation).toBe('Anticoagulação oral recomendada');
  });

  it('female only = score 1, considers not anticoagulating', () => {
    const r = cha2ds2vasc({ female: true });
    expect(r.score).toBe(1);
    expect(r.strokeRiskPercent).toBe(1.3);
    expect(r.recommendation).toBe('Considerar não anticoagular');
  });

  it('female + hypertension = score 2, recommends anticoagulation', () => {
    const r = cha2ds2vasc({ female: true, hypertension: true });
    expect(r.score).toBe(2);
    expect(r.strokeRiskPercent).toBe(2.2);
    expect(r.recommendation).toBe('Anticoagulação oral recomendada');
  });

  it('score 1 (not female) = considers anticoagulation', () => {
    const r = cha2ds2vasc({ diabetes: true });
    expect(r.score).toBe(1);
    expect(r.recommendation).toBe('Considerar anticoagulação oral');
  });

  it('all true = score 9, 15.2% risk', () => {
    const r = cha2ds2vasc({
      chf: true,
      hypertension: true,
      age75: true,
      diabetes: true,
      stroke: true,
      vascular: true,
      age65: true,
      female: true,
    });
    expect(r.score).toBe(9);
    expect(r.strokeRiskPercent).toBe(15.2);
    expect(r.recommendation).toBe('Anticoagulação oral recomendada');
  });

  it('undefined values default to empty — no crash', () => {
    const r = cha2ds2vasc();
    expect(r.score).toBe(0);
  });

  it('stroke risk table values match Lip 2010 for each score', () => {
    // Validate all table entries against published data
    const expected = [0, 1.3, 2.2, 3.2, 4.0, 6.7, 9.8, 9.6, 6.7, 15.2];
    // Score 0
    expect(cha2ds2vasc({}).strokeRiskPercent).toBe(expected[0]);
    // Score 3
    expect(cha2ds2vasc({ chf: true, hypertension: true, diabetes: true }).strokeRiskPercent).toBe(
      expected[3]
    );
    // Score 5
    expect(
      cha2ds2vasc({ chf: true, hypertension: true, age75: true, diabetes: true }).strokeRiskPercent
    ).toBe(expected[5]);
  });
});

// =============================================================================
// HAS-BLED
// Ref: Pisters R et al. Chest 2010;138(5):1093-1100
// =============================================================================

describe('hasbled', () => {
  it('all false = score 0, baixo risco', () => {
    const r = hasbled({});
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(9);
    expect(r.bleedingRisk).toBe('1.0-3.7%');
    expect(r.interpretation).toBe('Baixo risco de sangramento');
  });

  it('score 2 = still low risk', () => {
    const r = hasbled({ hypertension: true, elderly: true });
    expect(r.score).toBe(2);
    expect(r.bleedingRisk).toBe('1.0-3.7%');
    expect(r.interpretation).toBe('Baixo risco de sangramento');
  });

  it('score 3 = alto risco', () => {
    const r = hasbled({ hypertension: true, renalDisease: true, stroke: true });
    expect(r.score).toBe(3);
    expect(r.bleedingRisk).toBe('>3.7%');
    expect(r.interpretation).toContain('Alto risco');
  });

  it('all true = score 9', () => {
    const r = hasbled({
      hypertension: true,
      renalDisease: true,
      liverDisease: true,
      stroke: true,
      bleeding: true,
      labileInr: true,
      elderly: true,
      drugs: true,
      alcohol: true,
    });
    expect(r.score).toBe(9);
    expect(r.bleedingRisk).toBe('>3.7%');
  });

  it('undefined values default to empty — no crash', () => {
    const r = hasbled();
    expect(r.score).toBe(0);
  });
});

// =============================================================================
// afibPanel — integrated recommendation
// =============================================================================

describe('afibPanel', () => {
  it('CHADS=0, HASBLED=0 → sem indicação', () => {
    const r = afibPanel({}, {});
    expect(r.chads.score).toBe(0);
    expect(r.hasbled.score).toBe(0);
    expect(r.recommendation).toBe('Sem indicação de anticoagulação');
  });

  it('CHADS=3, HASBLED=1 → anticoagulação recomendada, baixo risco', () => {
    const r = afibPanel(
      { chf: true, hypertension: true, diabetes: true },
      { elderly: true }
    );
    expect(r.chads.score).toBe(3);
    expect(r.hasbled.score).toBe(1);
    expect(r.recommendation).toBe('Anticoagulação recomendada — baixo risco de sangramento');
  });

  it('CHADS=4, HASBLED=4 → anticoagulação recomendada com ATENÇÃO sangramento', () => {
    const r = afibPanel(
      { chf: true, age75: true, diabetes: true },
      { hypertension: true, renalDisease: true, stroke: true, bleeding: true }
    );
    expect(r.chads.score).toBe(4);
    expect(r.hasbled.score).toBe(4);
    expect(r.recommendation).toContain('ATENÇÃO');
    expect(r.recommendation).toContain('Corrigir fatores modificáveis');
  });

  it('CHADS=1 (not female), HASBLED=2 → considerar anticoagulação', () => {
    const r = afibPanel(
      { vascular: true },
      { hypertension: true, elderly: true }
    );
    expect(r.chads.score).toBe(1);
    expect(r.hasbled.score).toBe(2);
    expect(r.recommendation).toBe(
      'Considerar anticoagulação — avaliar risco-benefício com HAS-BLED'
    );
  });

  it('CHADS=1 (isolated female) → sem indicação', () => {
    const r = afibPanel({ female: true }, {});
    expect(r.chads.score).toBe(1);
    expect(r.recommendation).toBe('Sem indicação de anticoagulação');
  });

  it('CHADS=2, HASBLED=3 boundary → still recommends anticoagulation with warning', () => {
    const r = afibPanel(
      { hypertension: true, diabetes: true },
      { renalDisease: true, bleeding: true, drugs: true }
    );
    expect(r.chads.score).toBe(2);
    expect(r.hasbled.score).toBe(3);
    expect(r.recommendation).toContain('ATENÇÃO');
  });

  it('returns both sub-scores as nested objects', () => {
    const r = afibPanel({ chf: true }, { alcohol: true });
    expect(r.chads).toHaveProperty('score', 1);
    expect(r.chads).toHaveProperty('maxScore', 9);
    expect(r.chads).toHaveProperty('strokeRiskPercent');
    expect(r.chads).toHaveProperty('recommendation');
    expect(r.hasbled).toHaveProperty('score', 1);
    expect(r.hasbled).toHaveProperty('maxScore', 9);
    expect(r.hasbled).toHaveProperty('bleedingRisk');
    expect(r.hasbled).toHaveProperty('interpretation');
    expect(r).toHaveProperty('recommendation');
  });
});
