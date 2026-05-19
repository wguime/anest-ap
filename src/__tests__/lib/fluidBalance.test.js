import { describe, it, expect } from 'vitest';
import {
  maintenanceRate,
  ebvPerKg,
  estimatedBloodVolume,
  fastingDeficit,
  furmanReplacement,
  thirdSpaceLoss,
  ablGross,
  bloodReplacement,
  urineGoal,
  evaluateBalance,
} from '@/lib/fluidBalance';

// Tolerância para comparações de float (1 ml é clinicamente irrelevante).
const TOL = 1;

describe('maintenanceRate (Holliday-Segar 4-2-1)', () => {
  it('peso ≤ 0 retorna 0', () => {
    expect(maintenanceRate(0)).toBe(0);
    expect(maintenanceRate(-5)).toBe(0);
    expect(maintenanceRate(null)).toBe(0);
    expect(maintenanceRate(undefined)).toBe(0);
  });

  it('faixa 0-10 kg → 4 ml/kg/h', () => {
    expect(maintenanceRate(8)).toBe(32);
    expect(maintenanceRate(10)).toBe(40);
    expect(maintenanceRate(3)).toBe(12); // neonato
  });

  it('faixa 10-20 kg → 40 + 2(peso-10)', () => {
    expect(maintenanceRate(15)).toBe(50);
    expect(maintenanceRate(20)).toBe(60);
  });

  it('faixa >20 kg → 60 + 1(peso-20)', () => {
    expect(maintenanceRate(30)).toBe(70);
    expect(maintenanceRate(70)).toBe(110); // adulto referência
    expect(maintenanceRate(150)).toBe(190); // obeso usa peso real (UI orienta IBW)
  });
});

describe('ebvPerKg + estimatedBloodVolume', () => {
  it('volume sanguíneo por kg conforme faixa', () => {
    expect(ebvPerKg('prematuro')).toBe(95);
    expect(ebvPerKg('neonato')).toBe(85);
    expect(ebvPerKg('lactente')).toBe(80);
    expect(ebvPerKg('crianca')).toBe(75);
    expect(ebvPerKg('adulto')).toBe(70);
  });

  it('faixa desconhecida cai em adulto (70)', () => {
    expect(ebvPerKg('xyz')).toBe(70);
  });

  it('EBV neonato 3 kg → 255 ml', () => {
    expect(estimatedBloodVolume(3, 'neonato')).toBe(255);
  });

  it('EBV adulto 70 kg → 4900 ml', () => {
    expect(estimatedBloodVolume(70, 'adulto')).toBe(4900);
  });

  it('peso 0 → EBV 0', () => {
    expect(estimatedBloodVolume(0, 'adulto')).toBe(0);
  });
});

describe('fastingDeficit', () => {
  it('NPO 0 h → déficit 0', () => {
    expect(fastingDeficit(70, 0)).toBe(0);
  });

  it('adulto 70 kg, NPO 8 h → 880 ml (110 × 8)', () => {
    expect(fastingDeficit(70, 8)).toBe(880);
  });

  it('ped 15 kg, NPO 6 h → 300 ml (50 × 6)', () => {
    expect(fastingDeficit(15, 6)).toBe(300);
  });

  it('NPO negativo é tratado como 0', () => {
    expect(fastingDeficit(70, -3)).toBe(0);
  });
});

describe('furmanReplacement (50/25/25)', () => {
  it('adulto 70 kg, NPO 8 h: hora 1 ≈ 550 ml', () => {
    // déficit 880; 50% = 440; + manutenção 110 = 550
    expect(furmanReplacement(70, 8, 1)).toBe(550);
  });

  it('hora 2: 25% déficit + manut = 330 ml', () => {
    expect(furmanReplacement(70, 8, 2)).toBe(330);
  });

  it('hora 3: 25% déficit + manut = 330 ml', () => {
    expect(furmanReplacement(70, 8, 3)).toBe(330);
  });

  it('hora 4+: apenas manutenção', () => {
    expect(furmanReplacement(70, 8, 4)).toBe(110);
    expect(furmanReplacement(70, 8, 10)).toBe(110);
  });

  it('sem déficit (NPO 0): hora 1 = apenas manutenção', () => {
    expect(furmanReplacement(70, 0, 1)).toBe(110);
  });
});

describe('thirdSpaceLoss', () => {
  it('porte pequeno: 2 ml/kg/h', () => {
    expect(thirdSpaceLoss(70, 'pequeno')).toBe(140);
  });

  it('porte médio: 4 ml/kg/h', () => {
    expect(thirdSpaceLoss(70, 'medio')).toBe(280);
  });

  it('porte grande: 6 ml/kg/h', () => {
    expect(thirdSpaceLoss(70, 'grande')).toBe(420);
  });

  it('porte inválido ou ausente: 0', () => {
    expect(thirdSpaceLoss(70, undefined)).toBe(0);
    expect(thirdSpaceLoss(70, 'XPTO')).toBe(0);
  });
});

describe('ablGross', () => {
  it('adulto 70 kg, Hct 40 → 25 → ~1837 ml', () => {
    // EBV = 4900; (40-25)/40 = 0.375; ABL = 1837.5
    expect(ablGross(70, 'adulto', 40, 25)).toBeCloseTo(1837.5, 1);
  });

  it('Hi ≤ Hf retorna 0 (sem margem)', () => {
    expect(ablGross(70, 'adulto', 30, 30)).toBe(0);
    expect(ablGross(70, 'adulto', 25, 30)).toBe(0);
  });

  it('peso 0 retorna 0', () => {
    expect(ablGross(0, 'adulto', 40, 25)).toBe(0);
  });

  it('ped 15 kg neonato Hct 45→30 → ~425 ml', () => {
    // EBV = 1275; (45-30)/45 = 0.333; ABL = 425
    expect(ablGross(15, 'neonato', 45, 30)).toBeCloseTo(425, 0);
  });
});

describe('bloodReplacement', () => {
  it('cristaloide 3:1', () => {
    expect(bloodReplacement(300, 'cristaloide')).toBe(900);
  });

  it('coloide 1:1', () => {
    expect(bloodReplacement(300, 'coloide')).toBe(300);
  });

  it('sangue 1:1', () => {
    expect(bloodReplacement(300, 'sangue')).toBe(300);
  });

  it('perda 0 → 0', () => {
    expect(bloodReplacement(0, 'cristaloide')).toBe(0);
  });

  it('perda negativa tratada como 0', () => {
    expect(bloodReplacement(-50, 'cristaloide')).toBe(0);
  });
});

describe('urineGoal', () => {
  it('adulto 70 kg → 35 ml/h', () => {
    expect(urineGoal(70, false)).toBe(35);
  });

  it('pediátrico 15 kg → 15 ml/h', () => {
    expect(urineGoal(15, true)).toBe(15);
  });
});

describe('evaluateBalance — integração', () => {
  const baseAdulto = {
    weightKg: 70,
    npoHours: 8,
    porte: 'medio',
    category: 'adulto',
    hctInicial: 40,
    hctMinimo: 25,
    isPediatric: false,
  };

  it('sem horas → todos os totais em 0', () => {
    const r = evaluateBalance({ ...baseAdulto, hours: [] });
    expect(r.totalInfundido).toBe(0);
    expect(r.totalSangramento).toBe(0);
    expect(r.balancoNet).toBe(0);
    expect(r.alerts).toHaveLength(0);
    expect(r.abl).toBeCloseTo(1837.5, 1);
    expect(r.rate).toBe(110);
    expect(r.tsLoss).toBe(280); // 70 kg × 4 ml/kg/h (médio porte)
    expect(r.goalRate).toBe(35);
    expect(r.totalManutencao).toBe(0);
    expect(r.totalTerceiroEspaco).toBe(0);
  });

  it('separa totalManutencao e totalTerceiroEspaco', () => {
    const hours = [{ cristaloide: 500 }, { cristaloide: 500 }];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.totalManutencao).toBe(220); // 110 × 2 h
    expect(r.totalTerceiroEspaco).toBe(560); // 280 × 2 h
    expect(r.perdaInsensivel).toBe(780); // soma dos dois
  });

  it('3 horas com sangramento 700 ml cada → ABL atingida', () => {
    const hours = [
      { cristaloide: 1000, coloide: 0, sangueDerivados: 0, sangramento: 700, diurese: 50, outras: 0 },
      { cristaloide: 800, coloide: 0, sangueDerivados: 0, sangramento: 700, diurese: 50, outras: 0 },
      { cristaloide: 800, coloide: 0, sangueDerivados: 0, sangramento: 700, diurese: 50, outras: 0 },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.totalSangramento).toBe(2100);
    expect(r.totalInfundido).toBe(2600);
    expect(r.alerts.some((a) => a.message.includes('ABL atingida'))).toBe(true);
  });

  it('balanço positivo > 1500 após 3 h → alerta sobrecarga', () => {
    const hours = [
      { cristaloide: 2000, sangramento: 0, diurese: 50 },
      { cristaloide: 2000, sangramento: 0, diurese: 50 },
      { cristaloide: 2000, sangramento: 0, diurese: 50 },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    // 6000 infundido − (110+280)*3 perdas insens. − 150 diurese = 6000 − 1170 − 150 = 4680
    expect(r.balancoNet).toBeGreaterThan(1500);
    expect(r.alerts.some((a) => a.message.includes('Balanço positivo'))).toBe(true);
  });

  it('oligúria: 2 h consecutivas com diurese < meta → alerta', () => {
    const hours = [
      { cristaloide: 500, sangramento: 0, diurese: 20 }, // < 35
      { cristaloide: 500, sangramento: 0, diurese: 15 }, // < 35
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.alerts.some((a) => a.message.includes('Oligúria'))).toBe(true);
  });

  it('oligúria: diurese 0 (não preenchida) NÃO dispara alerta', () => {
    // diurese 0 = não medida ainda; só alerta se medido > 0 mas baixo
    const hours = [
      { cristaloide: 500, sangramento: 0, diurese: 0 },
      { cristaloide: 500, sangramento: 0, diurese: 0 },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.alerts.some((a) => a.message.includes('Oligúria'))).toBe(false);
  });

  it('hipovolemia: balanço < -1000 com sangramento', () => {
    const hours = [
      { cristaloide: 100, sangramento: 1500, diurese: 50 },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.balancoNet).toBeLessThan(-1000);
    expect(r.alerts.some((a) => a.message.includes('Hipovolemia'))).toBe(true);
  });

  it('ped 15 kg: meta de diurese 15 ml/h e EBV 1125 ml', () => {
    const r = evaluateBalance({
      weightKg: 15,
      npoHours: 6,
      porte: 'pequeno',
      category: 'crianca',
      hctInicial: 35,
      hctMinimo: 25,
      isPediatric: true,
      hours: [],
    });
    expect(r.goalRate).toBe(15);
    expect(r.rate).toBe(50);
    // EBV 15*75 = 1125; ABL = 1125 * (35-25)/35 ≈ 321
    expect(r.abl).toBeCloseTo(321.4, 0);
  });
});

describe('edge cases', () => {
  it('peso 150 kg (obeso): manutenção limitada a 190 ml/h (não estoura)', () => {
    expect(maintenanceRate(150)).toBe(190);
  });

  it('strings numéricas são aceitas (compatibilidade com input)', () => {
    expect(maintenanceRate('70')).toBe(110);
    expect(fastingDeficit('70', '8')).toBe(880);
  });

  it('campos faltantes em horas → tratados como 0', () => {
    const r = evaluateBalance({
      weightKg: 70,
      npoHours: 0,
      porte: 'pequeno',
      category: 'adulto',
      hctInicial: 40,
      hctMinimo: 25,
      isPediatric: false,
      hours: [{}, { cristaloide: 500 }],
    });
    expect(r.totalInfundido).toBe(500);
    expect(r.totalSangramento).toBe(0);
  });
});

void TOL; // reservado para uso futuro
