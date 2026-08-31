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
export function ebvPerKg(category) {
  const map = {
    prematuro: 95,
    neonato: 85,
    lactente: 80,
    crianca: 75,
    adulto: 70,
  };
  return map[category] ?? 70;
}

/**
 * Volume sanguíneo estimado total (ml).
 */
export function estimatedBloodVolume(weightKg, category) {
  const w = num(weightKg);
  if (w <= 0) return 0;
  return w * ebvPerKg(category);
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
export function ablGross(weightKg, category, hctInicial, hctMinimo) {
  const ebv = estimatedBloodVolume(weightKg, category);
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
}) {
  const rate = maintenanceRate(weightKg);
  const tsLoss = thirdSpaceLoss(weightKg, porte);
  const abl = ablGross(weightKg, category, hctInicial, hctMinimo);
  const goalRate = urineGoal(weightKg, isPediatric);

  let totalInfundido = 0;
  let totalSangramento = 0;
  let totalDiurese = 0;
  let totalOutras = 0;

  hours.forEach((h) => {
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

  // Anúria: zero MEDIDO. Reportada pela hora mais recente, que é a acionável.
  let horaAnuria = -1;
  diureses.forEach((d, i) => {
    if (d === 0) horaAnuria = i;
  });
  if (horaAnuria >= 0) {
    alerts.push({
      level: 'destructive',
      message: `Anúria na hora ${horaAnuria + 1}: diurese 0 ml registrada — investigar causa pré-renal, renal ou obstrutiva.`,
    });
  }

  if (horasN >= 2) {
    const ultimas2 = diureses.slice(-2);
    const oliguria = ultimas2.every((d) => d !== null && d > 0 && d < goalRate);
    if (oliguria) {
      alerts.push({
        level: 'warning',
        message: `Oligúria: diurese < ${goalRate.toFixed(0)} ml/h em 2 h consecutivas.`,
      });
    }
  }

  if (abl > 0 && totalSangramento >= abl) {
    alerts.push({
      level: 'destructive',
      message: 'ABL atingida — considerar transfusão de hemoderivados.',
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
    alerts,
  };
}
