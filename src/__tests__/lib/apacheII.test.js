import { describe, it, expect } from 'vitest';
import {
  apacheII,
  scoreAge,
  scoreTemperature,
  scoreMAP,
  scoreHR,
  scoreRR,
  scoreOxygenation,
  scorePH,
  scoreSodium,
  scorePotassium,
  scoreCreatinine,
  scoreHematocrit,
  scoreWBC,
  scoreGCS,
  scoreChronicHealth,
  mortalityBand,
} from '../../lib/apacheII';

describe('APACHE II individual scoring functions', () => {
  describe('scoreAge', () => {
    it('scores age brackets correctly', () => {
      expect(scoreAge(30)).toBe(0);
      expect(scoreAge(44)).toBe(0);
      expect(scoreAge(45)).toBe(2);
      expect(scoreAge(54)).toBe(2);
      expect(scoreAge(55)).toBe(3);
      expect(scoreAge(64)).toBe(3);
      expect(scoreAge(65)).toBe(5);
      expect(scoreAge(74)).toBe(5);
      expect(scoreAge(75)).toBe(6);
      expect(scoreAge(90)).toBe(6);
    });
  });

  describe('scoreTemperature', () => {
    it('scores normal temperature as 0', () => {
      expect(scoreTemperature(37)).toBe(0);
      expect(scoreTemperature(36)).toBe(0);
      expect(scoreTemperature(38.4)).toBe(0);
    });

    it('scores low-grade fever/mild hypothermia as 1', () => {
      expect(scoreTemperature(38.5)).toBe(1);
      expect(scoreTemperature(38.9)).toBe(1);
      expect(scoreTemperature(35.9)).toBe(1);
      expect(scoreTemperature(34)).toBe(1);
    });

    it('scores moderate hypothermia as 2', () => {
      expect(scoreTemperature(33.9)).toBe(2);
      expect(scoreTemperature(32)).toBe(2);
    });

    it('scores high fever/severe hypothermia as 3', () => {
      expect(scoreTemperature(39)).toBe(3);
      expect(scoreTemperature(40.9)).toBe(3);
      expect(scoreTemperature(31.9)).toBe(3);
      expect(scoreTemperature(30)).toBe(3);
    });

    it('scores extreme temps as 4', () => {
      expect(scoreTemperature(41)).toBe(4);
      expect(scoreTemperature(42)).toBe(4);
      expect(scoreTemperature(29.9)).toBe(4);
      expect(scoreTemperature(28)).toBe(4);
    });
  });

  describe('scoreMAP', () => {
    it('scores normal MAP as 0', () => {
      expect(scoreMAP(70)).toBe(0);
      expect(scoreMAP(80)).toBe(0);
      expect(scoreMAP(109)).toBe(0);
    });

    it('scores MAP 110-129 as 2', () => {
      expect(scoreMAP(110)).toBe(2);
      expect(scoreMAP(120)).toBe(2);
      expect(scoreMAP(129)).toBe(2);
    });

    it('scores MAP 130-159 as 3 (not 2)', () => {
      expect(scoreMAP(130)).toBe(3);
      expect(scoreMAP(145)).toBe(3);
      expect(scoreMAP(159)).toBe(3);
    });

    it('scores MAP 50-69 as 2', () => {
      expect(scoreMAP(50)).toBe(2);
      expect(scoreMAP(60)).toBe(2);
      expect(scoreMAP(69)).toBe(2);
    });

    it('scores extreme MAP as 4', () => {
      expect(scoreMAP(160)).toBe(4);
      expect(scoreMAP(200)).toBe(4);
      expect(scoreMAP(49)).toBe(4);
      expect(scoreMAP(30)).toBe(4);
    });
  });

  describe('scoreHR', () => {
    it('scores normal HR as 0', () => {
      expect(scoreHR(70)).toBe(0);
      expect(scoreHR(80)).toBe(0);
      expect(scoreHR(109)).toBe(0);
    });

    it('scores HR 110-139 and 55-69 as 2', () => {
      expect(scoreHR(110)).toBe(2);
      expect(scoreHR(139)).toBe(2);
      expect(scoreHR(55)).toBe(2);
      expect(scoreHR(69)).toBe(2);
    });

    it('scores HR 140-179 and 40-54 as 3', () => {
      expect(scoreHR(140)).toBe(3);
      expect(scoreHR(179)).toBe(3);
      expect(scoreHR(40)).toBe(3);
      expect(scoreHR(54)).toBe(3);
    });

    it('scores extreme HR as 4', () => {
      expect(scoreHR(180)).toBe(4);
      expect(scoreHR(39)).toBe(4);
    });
  });

  describe('scoreRR', () => {
    it('scores normal RR (12-24) as 0', () => {
      expect(scoreRR(12)).toBe(0);
      expect(scoreRR(16)).toBe(0);
      expect(scoreRR(24)).toBe(0);
    });

    it('scores RR 25-34 and 10-11 as 1', () => {
      expect(scoreRR(25)).toBe(1);
      expect(scoreRR(34)).toBe(1);
      expect(scoreRR(10)).toBe(1);
      expect(scoreRR(11)).toBe(1);
    });

    it('scores RR 6-9 as 2', () => {
      expect(scoreRR(6)).toBe(2);
      expect(scoreRR(9)).toBe(2);
    });

    it('scores RR 35-49 as 3', () => {
      expect(scoreRR(35)).toBe(3);
      expect(scoreRR(49)).toBe(3);
    });

    it('scores extreme RR as 4', () => {
      expect(scoreRR(50)).toBe(4);
      expect(scoreRR(5)).toBe(4);
    });
  });

  describe('scoreOxygenation', () => {
    it('scores PaO2 > 70 (FiO2 < 50%) as 0', () => {
      expect(scoreOxygenation('pao2_70')).toBe(0);
    });

    it('scores PaO2 61-70 as 1', () => {
      expect(scoreOxygenation('pao2_61_70')).toBe(1);
    });

    it('scores PaO2 55-60 as 3 (not 1)', () => {
      expect(scoreOxygenation('pao2_55_60')).toBe(3);
    });

    it('scores PaO2 < 55 as 4 (not 1)', () => {
      expect(scoreOxygenation('pao2_55')).toBe(4);
    });

    it('scores A-aDO2 correctly for FiO2 >= 50%', () => {
      expect(scoreOxygenation('aado2_200')).toBe(0);
      expect(scoreOxygenation('aado2_350')).toBe(2);
      expect(scoreOxygenation('aado2_500')).toBe(3);
      expect(scoreOxygenation('aado2_500p')).toBe(4);
    });
  });

  describe('scorePH', () => {
    it('scores normal pH as 0', () => {
      expect(scorePH(7.4)).toBe(0);
      expect(scorePH(7.35)).toBe(0);
      expect(scorePH(7.49)).toBe(0);
    });

    it('scores mild alkalosis and mild acidosis', () => {
      expect(scorePH(7.5)).toBe(1);
      expect(scorePH(7.59)).toBe(1);
      expect(scorePH(7.32)).toBe(2);
      expect(scorePH(7.25)).toBe(2);
    });

    it('scores severe acid/base as 3-4', () => {
      expect(scorePH(7.6)).toBe(3);
      expect(scorePH(7.24)).toBe(3);
      expect(scorePH(7.7)).toBe(4);
      expect(scorePH(7.14)).toBe(4);
    });
  });

  describe('scoreSodium', () => {
    it('scores normal Na as 0', () => {
      expect(scoreSodium(140)).toBe(0);
    });

    it('scores boundaries correctly', () => {
      expect(scoreSodium(150)).toBe(1);
      expect(scoreSodium(154)).toBe(1);
      expect(scoreSodium(155)).toBe(2);
      expect(scoreSodium(129)).toBe(2);
      expect(scoreSodium(160)).toBe(3);
      expect(scoreSodium(119)).toBe(3);
      expect(scoreSodium(180)).toBe(4);
      expect(scoreSodium(110)).toBe(4);
    });
  });

  describe('scorePotassium', () => {
    it('scores normal K as 0', () => {
      expect(scorePotassium(4)).toBe(0);
      expect(scorePotassium(3.5)).toBe(0);
      expect(scorePotassium(5.4)).toBe(0);
    });

    it('scores K 2.5-2.9 as 2 (not 1)', () => {
      expect(scorePotassium(2.5)).toBe(2);
      expect(scorePotassium(2.7)).toBe(2);
      expect(scorePotassium(2.9)).toBe(2);
    });

    it('scores mild hypo/hyperkalemia as 1', () => {
      expect(scorePotassium(5.5)).toBe(1);
      expect(scorePotassium(5.9)).toBe(1);
      expect(scorePotassium(3.0)).toBe(1);
      expect(scorePotassium(3.4)).toBe(1);
    });

    it('scores K >= 6 as 3', () => {
      expect(scorePotassium(6)).toBe(3);
      expect(scorePotassium(6.9)).toBe(3);
    });

    it('scores extreme K as 4', () => {
      expect(scorePotassium(7)).toBe(4);
      expect(scorePotassium(2.4)).toBe(4);
    });
  });

  describe('scoreCreatinine', () => {
    it('scores normal creatinine as 0', () => {
      expect(scoreCreatinine(1, false)).toBe(0);
      expect(scoreCreatinine(1.4, false)).toBe(0);
      expect(scoreCreatinine(0.6, false)).toBe(0);
    });

    it('scores low creatinine < 0.6 as 2', () => {
      expect(scoreCreatinine(0.5, false)).toBe(2);
    });

    it('doubles score with acute renal failure', () => {
      expect(scoreCreatinine(0.5, true)).toBe(4);
      expect(scoreCreatinine(1.5, false)).toBe(2);
      expect(scoreCreatinine(1.5, true)).toBe(4);
      expect(scoreCreatinine(2, false)).toBe(3);
      expect(scoreCreatinine(2, true)).toBe(6);
      expect(scoreCreatinine(3.5, false)).toBe(4);
      expect(scoreCreatinine(3.5, true)).toBe(8);
    });
  });

  describe('scoreHematocrit', () => {
    it('scores normal Ht as 0', () => {
      expect(scoreHematocrit(40)).toBe(0);
      expect(scoreHematocrit(30)).toBe(0);
      expect(scoreHematocrit(45)).toBe(0);
    });

    it('scores Ht 46-49 as 1', () => {
      expect(scoreHematocrit(46)).toBe(1);
      expect(scoreHematocrit(49)).toBe(1);
    });

    it('scores Ht 50-59 and 20-29 as 2', () => {
      expect(scoreHematocrit(50)).toBe(2);
      expect(scoreHematocrit(20)).toBe(2);
      expect(scoreHematocrit(29)).toBe(2);
    });

    it('scores extreme Ht as 4', () => {
      expect(scoreHematocrit(60)).toBe(4);
      expect(scoreHematocrit(19)).toBe(4);
    });
  });

  describe('scoreWBC', () => {
    it('scores normal as 0', () => {
      expect(scoreWBC(10)).toBe(0);
      expect(scoreWBC(3)).toBe(0);
      expect(scoreWBC(14.9)).toBe(0);
    });

    it('scores moderate as 1-2', () => {
      expect(scoreWBC(15)).toBe(1);
      expect(scoreWBC(19)).toBe(1);
      expect(scoreWBC(20)).toBe(2);
      expect(scoreWBC(2)).toBe(2);
    });

    it('scores extreme as 4', () => {
      expect(scoreWBC(40)).toBe(4);
      expect(scoreWBC(0.5)).toBe(4);
    });
  });

  describe('scoreGCS', () => {
    it('scores GCS as 15 - GCS', () => {
      expect(scoreGCS(15)).toBe(0);
      expect(scoreGCS(14)).toBe(1);
      expect(scoreGCS(10)).toBe(5);
      expect(scoreGCS(3)).toBe(12);
    });
  });

  describe('scoreChronicHealth', () => {
    it('scores chronic health correctly', () => {
      expect(scoreChronicHealth('nenhuma')).toBe(0);
      expect(scoreChronicHealth('eletivo')).toBe(2);
      expect(scoreChronicHealth('emergencia')).toBe(5);
    });
  });
});

describe('apacheII composite', () => {
  it('returns 0 for healthy young patient with normal vitals', () => {
    const result = apacheII({
      idade: 30, temp: 37, pam: 80, fc: 80, fr: 16,
      oxigenacao: 'pao2_70', ph: 7.4, sodio: 140, potassio: 4,
      creatinina: 1, ira: false, hematocrito: 40, leucocitos: 10,
      glasgow: 15, doenca_cronica: 'nenhuma',
    });
    expect(result.score).toBe(0);
    expect(result.risk).toBe('baixo');
  });

  it('calculates critically ill patient correctly', () => {
    const result = apacheII({
      idade: 78, temp: 41, pam: 45, fc: 185, fr: 52,
      oxigenacao: 'aado2_500p', ph: 7.1, sodio: 185, potassio: 7.5,
      creatinina: 5, ira: true, hematocrito: 15, leucocitos: 45,
      glasgow: 3, doenca_cronica: 'emergencia',
    });
    expect(result.score).toBeGreaterThan(50);
    expect(result.risk).toBe('critico');
  });

  it('includes breakdown with all 14 components', () => {
    const result = apacheII({});
    expect(Object.keys(result.breakdown)).toHaveLength(14);
    expect(result.breakdown).toHaveProperty('idade');
    expect(result.breakdown).toHaveProperty('oxigenacao');
  });

  it('correctly scores PaO2 < 55 as 4 in composite', () => {
    const result = apacheII({ oxigenacao: 'pao2_55' });
    expect(result.breakdown.oxigenacao).toBe(4);
  });

  it('correctly scores MAP 130-159 as 3 in composite', () => {
    const result = apacheII({ pam: 140 });
    expect(result.breakdown.pam).toBe(3);
  });

  it('correctly scores K 2.7 as 2 in composite', () => {
    const result = apacheII({ potassio: 2.7 });
    expect(result.breakdown.potassio).toBe(2);
  });
});

describe('mortalityBand', () => {
  it('maps score ranges to mortality and risk', () => {
    expect(mortalityBand(0).risk).toBe('baixo');
    expect(mortalityBand(10).risk).toBe('medio');
    expect(mortalityBand(20).risk).toBe('alto');
    expect(mortalityBand(35).risk).toBe('critico');
  });
});
