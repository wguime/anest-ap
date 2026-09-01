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
  medido,
  bloodVolumeNadler,
  clearanceCockcroftGault,
  estagioRenal,
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
    /* A string mudou em 31/08/2026 junto com o termo da tela: "ABL" saiu de
     * TODA a interface porque "perda permitida" sozinho não dizia perda de quê
     * (dono). O teste segue a mesma invariante — o alerta dispara quando o
     * sangramento alcança o limite —, só com o texto que o usuário lê. */
    expect(
      r.alerts.some((a) => a.message.includes('Perda sanguínea permitida atingida'))
    ).toBe(true);
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

  /* ⚠️ ESTE TESTE MUDOU DE LADO em 31/08/2026, a pedido do dono.
   *
   * Ele fixava: "diurese 0 NÃO dispara alerta", com a justificativa de que
   * 0 significava "não medida ainda". A justificativa era uma limitação da
   * entrada, não uma regra clínica: campo em branco e zero digitado chegavam
   * os dois como 0, e a única saída era calar os dois. O preço era calar
   * justamente a ANÚRIA, que é o pior achado urinário possível — o mesmo
   * defeito que `hemo_perdas_atls` teve até 30/08 ("a anúria não virava
   * classe IV").
   *
   * Com `medido()` os dois casos passaram a ser distinguíveis, então cada um
   * ganhou o seu teste abaixo: branco segue mudo, zero medido alerta. */
  it('diurese em BRANCO (não medida) não dispara alerta nenhum', () => {
    const hours = [
      { cristaloide: 500, sangramento: 0, diurese: '' },
      { cristaloide: 500, sangramento: 0, diurese: '' },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.alerts.some((a) => a.message.includes('Oligúria'))).toBe(false);
    expect(r.alerts.some((a) => a.message.includes('Anúria'))).toBe(false);
  });

  it('diurese 0 MEDIDA dispara anúria em nível destructive', () => {
    const hours = [
      { cristaloide: 500, sangramento: 0, diurese: '60' },
      { cristaloide: 500, sangramento: 0, diurese: '0' },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    const anuria = r.alerts.find((a) => a.message.includes('Anúria'));
    expect(anuria).toBeDefined();
    expect(anuria.level).toBe('destructive');
    expect(anuria.message).toContain('hora 2');
  });

  /* ⚠️ Defeito relatado pelo dono em 31/08: zero na PRIMEIRA hora deixava o
   * alerta vermelho na tela pelo resto da cirurgia, mesmo com o paciente
   * urinando nas horas seguintes. Anúria é ESTADO ATUAL: a frase está no
   * presente e o alerta é para agir agora. Zero na 1ª hora ainda é comum, com
   * a bexiga recém-esvaziada. */
  it('anúria SOME quando uma hora posterior tem diurese', () => {
    const r = evaluateBalance({
      ...baseAdulto,
      hours: [{ diurese: '0' }, { diurese: '40' }],
    });
    expect(r.alerts.some((a) => a.message.includes('Anúria'))).toBe(false);
  });

  it('anúria PERMANECE se a hora seguinte não foi medida — sem informação nova', () => {
    const r = evaluateBalance({
      ...baseAdulto,
      hours: [{ diurese: '0' }, { diurese: '' }],
    });
    expect(r.alerts.some((a) => a.message.includes('Anúria'))).toBe(true);
  });

  it('anúria volta se o zero reaparece depois de ter resolvido', () => {
    const r = evaluateBalance({
      ...baseAdulto,
      hours: [{ diurese: '0' }, { diurese: '40' }, { diurese: '0' }],
    });
    const a = r.alerts.find((x) => x.message.includes('Anúria'));
    expect(a).toBeDefined();
    expect(a.message).toContain('hora 3');
  });

  it('anúria aponta a hora MAIS RECENTE, que é a acionável', () => {
    const hours = [
      { diurese: '0' }, { diurese: '40' }, { diurese: 0 },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.alerts.find((a) => a.message.includes('Anúria')).message).toContain('hora 3');
  });

  it('anúria e oligúria convivem: zero na última, baixas nas duas últimas', () => {
    const hours = [
      { diurese: '20' }, { diurese: '10' },
    ];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.alerts.some((a) => a.message.includes('Oligúria'))).toBe(true);
    expect(r.alerts.some((a) => a.message.includes('Anúria'))).toBe(false);
  });

  /* A regra 3:1 / 1:1 estava na lib, testada e citada no infoBox do card —
   * e nenhuma tela a chamava. Agora `evaluateBalance` a devolve (dono 31/08). */
  it('devolve a reposição sugerida do sangramento acumulado', () => {
    const hours = [{ sangramento: 300 }, { sangramento: 100 }];
    const r = evaluateBalance({ ...baseAdulto, hours });
    expect(r.totalSangramento).toBe(400);
    expect(r.reposicaoCristaloide).toBe(1200); // 3:1
    expect(r.reposicaoColoide).toBe(400); // 1:1
  });

  it('sem sangramento, a reposição sugerida é 0 nos dois tipos', () => {
    const r = evaluateBalance({ ...baseAdulto, hours: [{ cristaloide: 500 }] });
    expect(r.reposicaoCristaloide).toBe(0);
    expect(r.reposicaoColoide).toBe(0);
  });

  it('o sexo muda a perda sanguínea permitida pela via do volume', () => {
    const h = evaluateBalance({ ...baseAdulto, sexo: 'masculino', hours: [] });
    const m = evaluateBalance({ ...baseAdulto, sexo: 'feminino', hours: [] });
    expect(h.ebv).toBe(5250);
    expect(m.ebv).toBe(4550);
    expect(h.abl).toBeGreaterThan(m.abl);
  });

  it('rim reduzido gera aviso, e NÃO muda a meta de diurese', () => {
    const r = evaluateBalance({
      ...baseAdulto, sexo: 'masculino', idadeAnos: 72, creatinina: 2.2,
      hours: [{ cristaloide: '500' }],
    });
    expect(r.renal.estagio).toBe('G3b');
    const aviso = r.alerts.find((a) => a.message.includes('Função renal reduzida'));
    expect(aviso).toBeDefined();
    expect(aviso.level).toBe('warning');
    // a meta continua sendo 0,5 ml/kg/h: perseguir diurese em rim ruim troca
    // um risco pelo de sobrecarga.
    expect(r.goalRate).toBe(35);
  });

  it('função renal normal não gera aviso nenhum', () => {
    const r = evaluateBalance({
      ...baseAdulto, sexo: 'masculino', idadeAnos: 30, creatinina: 0.9,
      hours: [{ cristaloide: '500' }],
    });
    expect(r.renal.reduzida).toBe(false);
    expect(r.alerts.some((a) => a.message.includes('Função renal reduzida'))).toBe(false);
  });

  it('coloide com ClCr < 30 alerta sobre HES; sem coloide, não', () => {
    const comColoide = evaluateBalance({
      ...baseAdulto, sexo: 'feminino', idadeAnos: 80, creatinina: 3.0,
      hours: [{ coloide: '500' }],
    });
    expect(comColoide.clcr).toBeLessThan(30);
    expect(comColoide.alerts.some((a) => a.message.includes('HES'))).toBe(true);

    const semColoide = evaluateBalance({
      ...baseAdulto, sexo: 'feminino', idadeAnos: 80, creatinina: 3.0,
      hours: [{ cristaloide: '500' }],
    });
    expect(semColoide.alerts.some((a) => a.message.includes('HES'))).toBe(false);
  });

  it('sem idade e creatinina, nenhum alerta renal aparece', () => {
    const r = evaluateBalance({ ...baseAdulto, hours: [{ coloide: '500' }] });
    expect(r.clcr).toBe(0);
    expect(r.renal).toBeNull();
    expect(r.alerts.some((a) => a.message.includes('HES'))).toBe(false);
    expect(r.alerts.some((a) => a.message.includes('Função renal'))).toBe(false);
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

describe('volume sanguíneo por sexo', () => {
  it('adulto: 75 ml/kg homem, 65 mulher, 70 sem sexo informado', () => {
    expect(ebvPerKg('adulto', 'masculino')).toBe(75);
    expect(ebvPerKg('adulto', 'feminino')).toBe(65);
    expect(ebvPerKg('adulto')).toBe(70);
    expect(ebvPerKg('adulto', '')).toBe(70);
  });

  it('criança não muda com o sexo — a faixa etária já dá o ml/kg', () => {
    expect(ebvPerKg('crianca', 'masculino')).toBe(75);
    expect(ebvPerKg('neonato', 'feminino')).toBe(85);
    expect(ebvPerKg('prematuro')).toBe(95);
  });

  it('Nadler homem 70 kg / 175 cm ≈ 4.824 ml', () => {
    expect(bloodVolumeNadler(70, 175, 'masculino')).toBeCloseTo(4823.7, 0);
  });

  it('Nadler mulher 60 kg / 162 cm ≈ 3.682 ml', () => {
    expect(bloodVolumeNadler(60, 162, 'feminino')).toBeCloseTo(3682.1, 0);
  });

  it('Nadler devolve 0 sem altura ou sem sexo — aí quem responde é ml/kg', () => {
    expect(bloodVolumeNadler(70, 0, 'masculino')).toBe(0);
    expect(bloodVolumeNadler(70, 175, '')).toBe(0);
    expect(bloodVolumeNadler(0, 175, 'masculino')).toBe(0);
  });

  it('estimatedBloodVolume prefere Nadler quando dá, e cai em ml/kg quando não', () => {
    expect(estimatedBloodVolume(70, 'adulto', { alturaCm: 175, sexo: 'masculino' })).toBeCloseTo(4823.7, 0);
    expect(estimatedBloodVolume(70, 'adulto', { sexo: 'masculino' })).toBe(5250);
    expect(estimatedBloodVolume(70, 'adulto', { sexo: 'feminino' })).toBe(4550);
  });

  it('a assinatura antiga de 2 argumentos continua valendo (70 ml/kg)', () => {
    expect(estimatedBloodVolume(70, 'adulto')).toBe(4900);
  });

  it('em criança, altura e sexo não acionam Nadler', () => {
    expect(estimatedBloodVolume(15, 'crianca', { alturaCm: 100, sexo: 'masculino' })).toBe(1125);
  });
});

describe('função renal — Cockcroft-Gault', () => {
  it('homem 60 anos, 70 kg, Cr 1,0 → (140-60)×70/(72×1) ≈ 77,8', () => {
    expect(clearanceCockcroftGault(60, 70, 1.0, 'masculino')).toBeCloseTo(77.8, 1);
  });

  it('mulher desconta 15%', () => {
    const h = clearanceCockcroftGault(60, 70, 1.0, 'masculino');
    const m = clearanceCockcroftGault(60, 70, 1.0, 'feminino');
    expect(m).toBeCloseTo(h * 0.85, 4);
  });

  it('sem sexo informado NÃO desconta — o desconto é da mulher', () => {
    expect(clearanceCockcroftGault(60, 70, 1.0)).toBeCloseTo(77.8, 1);
  });

  it('faltando qualquer dado devolve 0', () => {
    expect(clearanceCockcroftGault(0, 70, 1)).toBe(0);
    expect(clearanceCockcroftGault(60, 0, 1)).toBe(0);
    expect(clearanceCockcroftGault(60, 70, 0)).toBe(0);
  });

  it('estágios KDIGO nas fronteiras', () => {
    expect(estagioRenal(90).estagio).toBe('G1');
    expect(estagioRenal(89).estagio).toBe('G2');
    expect(estagioRenal(60).estagio).toBe('G2');
    expect(estagioRenal(59).estagio).toBe('G3a');
    expect(estagioRenal(45).estagio).toBe('G3a');
    expect(estagioRenal(44).estagio).toBe('G3b');
    expect(estagioRenal(30).estagio).toBe('G3b');
    expect(estagioRenal(29).estagio).toBe('G4');
    expect(estagioRenal(14).estagio).toBe('G5');
    expect(estagioRenal(0)).toBeNull();
  });

  it('reduzida começa em G3a — G1 e G2 não são', () => {
    expect(estagioRenal(95).reduzida).toBe(false);
    expect(estagioRenal(70).reduzida).toBe(false);
    expect(estagioRenal(50).reduzida).toBe(true);
  });
});

describe('medido — campo em branco não é zero', () => {
  it('branco, null e undefined devolvem null', () => {
    expect(medido('')).toBeNull();
    expect(medido('   ')).toBeNull();
    expect(medido(null)).toBeNull();
    expect(medido(undefined)).toBeNull();
  });

  it('zero medido devolve 0, não null', () => {
    expect(medido(0)).toBe(0);
    expect(medido('0')).toBe(0);
  });

  it('texto que não é número devolve null', () => {
    expect(medido('abc')).toBeNull();
  });

  it('aceita string numérica e número', () => {
    expect(medido('45')).toBe(45);
    expect(medido(45)).toBe(45);
    expect(medido('45.5')).toBe(45.5);
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
