import { describe, it, expect } from 'vitest';
import {
  saps3,
  scoreAge,
  scoreComorbidities,
  scoreDaysBeforeICU,
  scoreICUAdmissionSource,
  scorePlannedAdmission,
  scoreAdmissionReason,
  scoreSurgeryType,
  scoreInfection,
  scoreGCS,
  scoreBilirubin,
  scoreBodyTemp,
  scoreCreatinine,
  scoreHR,
  scoreSBP,
  scoreOxygenation,
  scorePH,
  scorePlatelets,
  scoreVasopressors,
  predictMortality,
} from '../../lib/saps3';

describe('SAPS 3 — Box I scoring', () => {
  describe('scoreAge', () => {
    it('scores age brackets', () => {
      expect(scoreAge(30)).toBe(0);
      expect(scoreAge(39)).toBe(0);
      expect(scoreAge(40)).toBe(5);
      expect(scoreAge(59)).toBe(5);
      expect(scoreAge(60)).toBe(9);
      expect(scoreAge(69)).toBe(9);
      expect(scoreAge(70)).toBe(13);
      expect(scoreAge(74)).toBe(13);
      expect(scoreAge(75)).toBe(15);
      expect(scoreAge(79)).toBe(15);
      expect(scoreAge(80)).toBe(18);
      expect(scoreAge(95)).toBe(18);
    });
  });

  describe('scoreComorbidities', () => {
    it('scores no comorbidities as 0', () => {
      expect(scoreComorbidities({})).toBe(0);
    });

    it('scores metastatic cancer highest (11)', () => {
      expect(scoreComorbidities({ cancerMetastatico: true })).toBe(11);
    });

    it('scores hematologic cancer (8)', () => {
      expect(scoreComorbidities({ cancerHematologico: true })).toBe(8);
    });

    it('metastatic overrides hematologic', () => {
      expect(scoreComorbidities({
        cancerMetastatico: true,
        cancerHematologico: true,
      })).toBe(11);
    });

    it('accumulates non-cancer comorbidities', () => {
      expect(scoreComorbidities({
        insufCardiacaNYHA4: true,
        cirrose: true,
        aids: true,
        irc: true,
      })).toBe(17);
    });
  });

  describe('scoreDaysBeforeICU', () => {
    it('scores days correctly', () => {
      expect(scoreDaysBeforeICU(0)).toBe(0);
      expect(scoreDaysBeforeICU(13)).toBe(0);
      expect(scoreDaysBeforeICU(14)).toBe(6);
      expect(scoreDaysBeforeICU(27)).toBe(6);
      expect(scoreDaysBeforeICU(28)).toBe(7);
    });
  });

  describe('scoreICUAdmissionSource', () => {
    it('scores OR as lowest (0)', () => {
      expect(scoreICUAdmissionSource('centro_cirurgico')).toBe(0);
    });

    it('scores ward as highest (8)', () => {
      expect(scoreICUAdmissionSource('enfermaria')).toBe(8);
    });
  });
});

describe('SAPS 3 — Box II scoring', () => {
  it('scores planned vs unplanned', () => {
    expect(scorePlannedAdmission(true)).toBe(0);
    expect(scorePlannedAdmission(false)).toBe(3);
  });

  it('scores sepsis as highest admission reason', () => {
    expect(scoreAdmissionReason('sepse')).toBe(8);
    expect(scoreAdmissionReason('cardiovascular')).toBe(0);
    expect(scoreAdmissionReason('respiratorio')).toBe(0);
  });

  it('scores surgery type', () => {
    expect(scoreSurgeryType('eletiva')).toBe(0);
    expect(scoreSurgeryType('sem_cirurgia')).toBe(5);
    expect(scoreSurgeryType('urgencia')).toBe(6);
    expect(scoreSurgeryType('emergencia')).toBe(8);
  });

  it('scores infection status', () => {
    expect(scoreInfection('sem_infeccao')).toBe(0);
    expect(scoreInfection('nosocomial')).toBe(4);
  });
});

describe('SAPS 3 — Box III scoring', () => {
  it('scores GCS brackets', () => {
    expect(scoreGCS(15)).toBe(0);
    expect(scoreGCS(13)).toBe(0);
    expect(scoreGCS(8)).toBe(4);
    expect(scoreGCS(12)).toBe(4);
    expect(scoreGCS(6)).toBe(7);
    expect(scoreGCS(7)).toBe(7);
    expect(scoreGCS(4)).toBe(10);
    expect(scoreGCS(5)).toBe(10);
    expect(scoreGCS(3)).toBe(15);
  });

  it('scores bilirubin', () => {
    expect(scoreBilirubin(1)).toBe(0);
    expect(scoreBilirubin(2)).toBe(4);
    expect(scoreBilirubin(5.9)).toBe(4);
    expect(scoreBilirubin(6)).toBe(5);
  });

  it('scores hypothermia', () => {
    expect(scoreBodyTemp(37)).toBe(0);
    expect(scoreBodyTemp(35)).toBe(0);
    expect(scoreBodyTemp(34.9)).toBe(7);
  });

  it('scores creatinine', () => {
    expect(scoreCreatinine(1)).toBe(0);
    expect(scoreCreatinine(1.2)).toBe(3);
    expect(scoreCreatinine(2)).toBe(6);
    expect(scoreCreatinine(3.5)).toBe(8);
  });

  it('scores HR', () => {
    expect(scoreHR(80)).toBe(0);
    expect(scoreHR(119)).toBe(0);
    expect(scoreHR(120)).toBe(5);
    expect(scoreHR(159)).toBe(5);
    expect(scoreHR(160)).toBe(7);
  });

  it('scores SBP', () => {
    expect(scoreSBP(120)).toBe(0);
    expect(scoreSBP(119)).toBe(3);
    expect(scoreSBP(70)).toBe(3);
    expect(scoreSBP(69)).toBe(8);
    expect(scoreSBP(40)).toBe(8);
    expect(scoreSBP(39)).toBe(11);
  });

  it('scores oxygenation with and without MV', () => {
    expect(scoreOxygenation(300, false)).toBe(0);
    expect(scoreOxygenation(150, false)).toBe(7);
    expect(scoreOxygenation(80, false)).toBe(11);
    expect(scoreOxygenation(300, true)).toBe(3);
    expect(scoreOxygenation(150, true)).toBe(9);
    expect(scoreOxygenation(80, true)).toBe(11);
  });

  it('scores pH', () => {
    expect(scorePH(7.4)).toBe(0);
    expect(scorePH(7.25)).toBe(0);
    expect(scorePH(7.24)).toBe(3);
  });

  it('scores platelets', () => {
    expect(scorePlatelets(200)).toBe(0);
    expect(scorePlatelets(100)).toBe(0);
    expect(scorePlatelets(99)).toBe(5);
    expect(scorePlatelets(50)).toBe(5);
    expect(scorePlatelets(49)).toBe(8);
    expect(scorePlatelets(20)).toBe(8);
    expect(scorePlatelets(19)).toBe(13);
  });

  it('scores vasopressors', () => {
    expect(scoreVasopressors(false)).toBe(0);
    expect(scoreVasopressors(true)).toBe(3);
  });
});

describe('saps3 composite', () => {
  it('returns minimum score of 16 for best-case patient', () => {
    const result = saps3({
      idade: 25, glasgow: 15, bilirrubina: 0.5, temperatura: 37,
      creatinina: 0.8, fc: 80, pas: 130, pao2fio2: 400,
      ph: 7.4, plaquetas: 250, vasopressores: false,
      admissaoPlanejada: true, origemAdmissao: 'centro_cirurgico',
      tipoCirurgia: 'eletiva', motivoAdmissao: 'cardiovascular',
      infeccao: 'sem_infeccao', diasAntesUTI: 0, comorbidades: {},
    });
    expect(result.score).toBe(16);
    expect(result.risk).toBe('baixo');
  });

  it('returns 3 boxes with breakdowns', () => {
    const result = saps3({});
    expect(result).toHaveProperty('boxI');
    expect(result).toHaveProperty('boxII');
    expect(result).toHaveProperty('boxIII');
    expect(result.boxI).toHaveProperty('total');
    expect(result.boxI).toHaveProperty('breakdown');
  });

  it('scores critically ill patient high', () => {
    const result = saps3({
      idade: 85, glasgow: 3, bilirrubina: 8, temperatura: 33,
      creatinina: 5, fc: 170, pas: 35, pao2fio2: 60,
      ventilacaoMecanica: true, ph: 7.1, plaquetas: 15,
      vasopressores: true, admissaoPlanejada: false,
      origemAdmissao: 'enfermaria', tipoCirurgia: 'emergencia',
      motivoAdmissao: 'sepse', infeccao: 'nosocomial',
      diasAntesUTI: 30, comorbidades: { cancerMetastatico: true, cirrose: true },
    });
    expect(result.score).toBeGreaterThan(100);
    expect(result.risk).toBe('critico');
  });

  it('includes mortality percentage', () => {
    const result = saps3({});
    expect(typeof result.mortalityPct).toBe('number');
    expect(result.mortalityPct).toBeGreaterThanOrEqual(0);
    expect(result.mortalityPct).toBeLessThanOrEqual(100);
  });
});

describe('predictMortality', () => {
  it('returns low mortality for low score', () => {
    expect(predictMortality(20)).toBeLessThan(5);
  });

  it('returns ~50% around score 64', () => {
    const mortality = predictMortality(64);
    expect(mortality).toBeGreaterThan(40);
    expect(mortality).toBeLessThan(60);
  });

  it('returns high mortality for high score', () => {
    expect(predictMortality(150)).toBeGreaterThan(90);
  });
});
