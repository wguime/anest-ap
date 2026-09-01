/**
 * Cálculos de balanço hídrico transoperatório (clássico).
 * Funções puras, sem React. Reutilizadas em UI + testáveis em Vitest.
 *
 * Refs clínicas:
 * - Holliday MA, Segar WE. Pediatrics 1957 (manutenção 4-2-1)
 * - Furman EB. Anesthesiology 1975 (reposição déficit 50/25/25)
 * - Gross JB. Anesthesiology 1983 (ABL)
 * - POQI-11 BJA 2024 (perspectiva moderna sobre terceiro espaço)
 */

const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Valor MEDIDO, ou null quando o campo não foi preenchido.
 *
 * ⚠️ `num()` devolve 0 tanto para "não medi" quanto para "medi 0", e era por
 * isso que a anúria — diurese 0, o pior achado urinário — ficava muda: o
 * alerta de oligúria exigia `d > 0` justamente para não disparar em campo
 * vazio. Separar os dois casos é o que permite alertar sobre o zero sem
 * alertar sobre o branco. Mesma família do defeito corrigido em
 * `hemo_perdas_atls` (anúria não virava classe IV).
 */
export function medido(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Manutenção horária pela regra 4-2-1 (ml/h).
 *   ≤10 kg     → 4 × peso
 *   10-20 kg   → 40 + 2 × (peso - 10)
 *   >20 kg     → 60 + 1 × (peso - 20)
 */
export function maintenanceRate(weightKg) {
  const w = num(weightKg);
  if (w <= 0) return 0;
  if (w <= 10) return w * 4;
  if (w <= 20) return 40 + (w - 10) * 2;
  return 60 + (w - 20);
}

/**
 * Volume sanguíneo estimado por kg conforme faixa.
 * Categorias: 'prematuro' | 'neonato' | 'lactente' | 'crianca' | 'adulto'.
 */
export function ebvPerKg(category, sexo) {
  // ⚠️ No ADULTO o volume varia com o sexo: 75 ml/kg no homem, 65 na mulher
  // (massa magra e hematócrito diferentes). O 70 continua sendo o valor de
  // quem não informou o sexo — é a média, e era o que o card usava para todo
  // mundo até 31/08/2026.
  if (category === 'adulto') {
    if (sexo === 'masculino') return 75;
    if (sexo === 'feminino') return 65;
    return 70;
  }
  const map = {
    prematuro: 95,
    neonato: 85,
    lactente: 80,
    crianca: 75,
  };
  return map[category] ?? 70;
}

/**
 * Volume sanguíneo pela equação de NADLER (1962), em ml.
 *
 * BV(L) = k1 × altura(m)³ + k2 × peso(kg) + k3
 *   homem:  0,3669 / 0,03219 / 0,6041
 *   mulher: 0,3561 / 0,03308 / 0,1833
 *
 * É a equação usada por Medscape e QxMD e a base das derivações posteriores.
 * Mais fiel que ml/kg porque separa o componente da ESTATURA do componente do
 * peso — em obeso, ml/kg superestima (tecido adiposo é pouco vascularizado).
 * Devolve 0 quando falta altura ou sexo: aí quem responde é `ebvPerKg`.
 */
export function bloodVolumeNadler(weightKg, alturaCm, sexo) {
  const w = num(weightKg);
  const h = num(alturaCm) / 100;
  if (w <= 0 || h <= 0) return 0;
  if (sexo !== 'masculino' && sexo !== 'feminino') return 0;
  const k = sexo === 'masculino'
    ? { k1: 0.3669, k2: 0.03219, k3: 0.6041 }
    : { k1: 0.3561, k2: 0.03308, k3: 0.1833 };
  return (k.k1 * h ** 3 + k.k2 * w + k.k3) * 1000;
}

/**
 * Volume sanguíneo estimado total (ml).
 *
 * Nadler quando dá (adulto com altura e sexo), ml/kg no resto. A assinatura
 * antiga `(peso, categoria)` continua valendo.
 */
export function estimatedBloodVolume(weightKg, category, opcoes = {}) {
  const w = num(weightKg);
  if (w <= 0) return 0;
  const { alturaCm, sexo } = opcoes;
  if (category === 'adulto') {
    const nadler = bloodVolumeNadler(w, alturaCm, sexo);
    if (nadler > 0) return nadler;
  }
  return w * ebvPerKg(category, sexo);
}

/**
 * Depuração de creatinina por COCKCROFT-GAULT (ml/min).
 *
 * ⚠️ MESMA fórmula do card `renal_cockroft` (calculator-definitions.js), de
 * propósito: duas contas de ClCr no mesmo app dariam dois números para o mesmo
 * paciente. ClCr = (140 − idade) × peso / (72 × Cr), × 0,85 se mulher.
 */
export function clearanceCockcroftGault(idadeAnos, weightKg, creatinina, sexo) {
  const idade = num(idadeAnos);
  const w = num(weightKg);
  const cr = num(creatinina);
  if (idade <= 0 || w <= 0 || cr <= 0) return 0;
  const base = ((140 - idade) * w) / (72 * cr);
  return sexo === 'feminino' ? base * 0.85 : base;
}

/** Estágio KDIGO da função renal. Mesmas faixas do card `renal_cockroft`. */
export function estagioRenal(clcr) {
  const v = num(clcr);
  if (v <= 0) return null;
  if (v >= 90) return { estagio: 'G1', rotulo: 'normal', reduzida: false };
  if (v >= 60) return { estagio: 'G2', rotulo: 'redução leve', reduzida: false };
  if (v >= 45) return { estagio: 'G3a', rotulo: 'redução leve a moderada', reduzida: true };
  if (v >= 30) return { estagio: 'G3b', rotulo: 'redução moderada a grave', reduzida: true };
  if (v >= 15) return { estagio: 'G4', rotulo: 'redução grave', reduzida: true };
  return { estagio: 'G5', rotulo: 'falência renal', reduzida: true };
}

/**
 * Déficit total de jejum (ml) = manutenção/h × horas NPO.
 */
export function fastingDeficit(weightKg, npoHours) {
  const rate = maintenanceRate(weightKg);
  const h = Math.max(0, num(npoHours));
  return rate * h;
}

/**
 * Reposição de déficit pelo esquema de Furman.
 *   Hora 1: 50% do déficit + manutenção
 *   Hora 2: 25% do déficit + manutenção
 *   Hora 3: 25% do déficit + manutenção
 *   Hora 4+: apenas manutenção
 *
 * Retorna o volume total a infundir naquela hora (ml).
 */
export function furmanReplacement(weightKg, npoHours, hourNumber) {
  const rate = maintenanceRate(weightKg);
  const deficit = fastingDeficit(weightKg, npoHours);
  const h = Math.max(1, Math.floor(num(hourNumber, 1)));
  if (h === 1) return deficit * 0.5 + rate;
  if (h === 2) return deficit * 0.25 + rate;
  if (h === 3) return deficit * 0.25 + rate;
  return rate;
}

/**
 * Perda esperada de terceiro espaço por hora (ml/h), conforme porte cirúrgico.
 *   pequeno: 2 ml/kg/h
 *   medio:   4 ml/kg/h
 *   grande:  6 ml/kg/h
 *
 * Coeficientes do POQI-11 (BJA 2024), que recomenda abordagem conservadora —
 * terceiro espaço é conceito controverso desde Chappell/Jacob 2008.
 * (Eram "alinhados com `ped_fluidos`"; esse card foi inativado em 30/08/2026
 * por duplicar o Balanço Hídrico Transoperatório, que é quem usa esta lib.)
 */
export function thirdSpaceLoss(weightKg, porte) {
  const map = { pequeno: 2, medio: 4, grande: 6 };
  const taxa = map[porte] ?? 0;
  return Math.max(0, num(weightKg) * taxa);
}

/**
 * Allowable Blood Loss (Gross, 1983).
 *   ABL = EBV × (Hi − Hf) / Hi
 *
 * Retorna 0 se Hi ≤ Hf (sem margem) ou EBV inválido.
 */
export function ablGross(weightKg, category, hctInicial, hctMinimo, opcoes = {}) {
  const ebv = estimatedBloodVolume(weightKg, category, opcoes);
  const hi = num(hctInicial);
  const hf = num(hctMinimo);
  if (ebv <= 0 || hi <= 0 || hf <= 0 || hi <= hf) return 0;
  return (ebv * (hi - hf)) / hi;
}

/**
 * Volume de reposição equivalente para uma perda sanguínea.
 *   cristaloide: 3:1
 *   coloide:     1:1
 *   sangue:      1:1
 */
export function bloodReplacement(bloodLossMl, fluidType) {
  const loss = Math.max(0, num(bloodLossMl));
  if (fluidType === 'cristaloide') return loss * 3;
  return loss;
}

/**
 * Meta de diurese (ml/h).
 *   adulto: ≥ 0.5 ml/kg/h
 *   pediátrico: ≥ 1 ml/kg/h
 */
export function urineGoal(weightKg, isPediatric) {
  const w = Math.max(0, num(weightKg));
  return isPediatric ? w * 1 : w * 0.5;
}

/**
 * Faixa etária da população — usado pelo display para escolher EBV e meta.
 */
export function categoryForPopulation(population) {
  return population === 'pediatrico' ? 'crianca' : 'adulto';
}

/**
 * Avalia uma série de horas e devolve totais acumulados + alertas.
 *
 * @param {Object} params
 * @param {number} params.weightKg
 * @param {number} params.npoHours
 * @param {string} params.porte
 * @param {string} params.category    'prematuro' | 'neonato' | 'lactente' | 'crianca' | 'adulto'
 * @param {number} params.hctInicial
 * @param {number} params.hctMinimo
 * @param {boolean} params.isPediatric
 * @param {Array} params.hours        [{cristaloide, coloide, sangueDerivados, sangramento, diurese, outras}]
 *
 * @returns totais e alertas para renderização.
 */
export function evaluateBalance({
  weightKg,
  npoHours: _npoHours,
  porte,
  category,
  hctInicial,
  hctMinimo,
  isPediatric,
  hours = [],
  alturaCm,
  sexo,
  idadeAnos,
  creatinina,
}) {
  const rate = maintenanceRate(weightKg);
  const tsLoss = thirdSpaceLoss(weightKg, porte);
  const opcoesCorpo = { alturaCm, sexo };
  const ebv = estimatedBloodVolume(weightKg, category, opcoesCorpo);
  const abl = ablGross(weightKg, category, hctInicial, hctMinimo, opcoesCorpo);
  const goalRate = urineGoal(weightKg, isPediatric);
  const clcr = clearanceCockcroftGault(idadeAnos, weightKg, creatinina, sexo);
  const renal = estagioRenal(clcr);

  let totalInfundido = 0;
  let totalSangramento = 0;
  let totalDiurese = 0;
  let totalOutras = 0;
  let totalColoide = 0;

  hours.forEach((h) => {
    totalColoide += num(h?.coloide);
    totalInfundido += num(h?.cristaloide) + num(h?.coloide) + num(h?.sangueDerivados);
    totalSangramento += num(h?.sangramento);
    totalDiurese += num(h?.diurese);
    totalOutras += num(h?.outras);
  });

  // ⚠️ `bloodReplacement` existia, estava testada e o infoBox citava a regra
  // 3:1 / 1:1 — mas NENHUMA tela a chamava. O card prometia uma conta que não
  // fazia (dono 31/08: "entra na conta").
  const horasN = hours.length;
  const totalManutencao = rate * horasN;
  const totalTerceiroEspaco = tsLoss * horasN;
  const perdaInsensivel = totalManutencao + totalTerceiroEspaco;
  const totalPerdido = totalSangramento + totalDiurese + totalOutras + perdaInsensivel;
  const balancoNet = totalInfundido - totalPerdido;
  const ablRestante = Math.max(0, abl - totalSangramento);
  const metaDiureseAcumulada = goalRate * horasN;
  const reposicaoCristaloide = bloodReplacement(totalSangramento, 'cristaloide');
  const reposicaoColoide = bloodReplacement(totalSangramento, 'coloide');

  // Diurese hora a hora, preservando a diferença entre não medido (null) e 0.
  const diureses = hours.map((h) => medido(h?.diurese));

  const alerts = [];

  if (horasN >= 3 && balancoNet > 1500) {
    alerts.push({
      level: 'warning',
      message: 'Balanço positivo > 1500 ml após 3 h — considerar restrição hídrica.',
    });
  }

  /* Anúria é ESTADO ATUAL, não histórico.
   *
   * ⚠️ A 1ª versão guardava o último índice com zero e nunca o limpava: um 0 na
   * hora 1 seguido de diurese normal na hora 2 mantinha o alerta VERMELHO pelo
   * resto da cirurgia, no presente ("Anúria na hora 1"), com o paciente
   * urinando (dono 31/08). Além de factualmente errado, é fadiga de alarme — e
   * zero na primeira hora é comum, com a bexiga recém-esvaziada e a sonda
   * recém-passada.
   *
   * Agora olha só a medição MAIS RECENTE: se ela é 0, há anúria agora; se veio
   * diurese depois, o episódio passou e o alerta sai. Hora não medida (branco)
   * não apaga o zero anterior — sem informação nova, o alerta se mantém. */
  let ultimaMedida = -1;
  diureses.forEach((d, i) => {
    if (d !== null) ultimaMedida = i;
  });
  if (ultimaMedida >= 0 && diureses[ultimaMedida] === 0) {
    alerts.push({
      level: 'destructive',
      message: `Anúria na hora ${ultimaMedida + 1}: diurese 0 ml registrada — investigar causa pré-renal, renal ou obstrutiva.`,
    });
  }

  if (horasN >= 2) {
    const ultimas2 = diureses.slice(-2);
    const oliguria = ultimas2.every((d) => d !== null && d > 0 && d < goalRate);
    if (oliguria) {
      alerts.push({
        level: 'warning',
        message:
          `Oligúria: diurese < ${goalRate.toFixed(0)} ml/h em 2 h consecutivas. ` +
          'Oligúria intraoperatória isolada é preditor fraco de LRA — avaliar volemia antes de expandir.',
      });
    }
  }

  /* Função renal reduzida muda a leitura do balanço, não a conta.
   *
   * ⚠️ NÃO subimos a meta de diurese: oligúria intraoperatória é preditor
   * FRACO de LRA (valor preditivo positivo de 25,5%) e o paciente oligúrico
   * hemodinamicamente estável NÃO responde a prova de volume. Perseguir
   * diurese com expansão em rim ruim troca um risco por outro — o de
   * sobrecarga, que ele tem menos como desfazer. */
  if (renal?.reduzida) {
    alerts.push({
      level: 'warning',
      message:
        `Função renal reduzida (ClCr ${clcr.toFixed(0)} ml/min, KDIGO ${renal.estagio}): ` +
        'menor capacidade de excretar volume — evitar balanço muito positivo, e não perseguir a meta de diurese com expansão.',
    });
  }

  /* Hidroxietilamido (HES) em rim ruim: a autorização europeia foi SUSPENSA em
   * 2022 e o FDA exige alerta em caixa, por lesão renal e mortalidade. O campo
   * "coloide" do card é genérico — albumina e gelatina não têm a mesma
   * restrição —, então o alerta nomeia o HES em vez de condenar o coloide. */
  if (totalColoide > 0 && clcr > 0 && clcr < 30) {
    alerts.push({
      level: 'destructive',
      message:
        `Coloide com ClCr ${clcr.toFixed(0)} ml/min: hidroxietilamido (HES) é contraindicado ` +
        '— autorização suspensa na UE (2022) por lesão renal e mortalidade. Albumina não tem essa restrição.',
    });
  }

  if (abl > 0 && totalSangramento >= abl) {
    alerts.push({
      level: 'destructive',
      message: 'Perda sanguínea permitida atingida — considerar transfusão de hemoderivados.',
    });
  }

  if (totalSangramento > 0 && balancoNet < -1000) {
    alerts.push({
      level: 'destructive',
      message: 'Hipovolemia possível: balanço negativo > 1000 ml com sangramento ativo.',
    });
  }

  return {
    rate,
    tsLoss,
    abl,
    goalRate,
    totalInfundido,
    totalSangramento,
    totalDiurese,
    totalOutras,
    totalManutencao,
    totalTerceiroEspaco,
    perdaInsensivel,
    totalPerdido,
    balancoNet,
    ablRestante,
    metaDiureseAcumulada,
    reposicaoCristaloide,
    reposicaoColoide,
    diureses,
    ebv,
    clcr,
    renal,
    totalColoide,
    alerts,
  };
}
