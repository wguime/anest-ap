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
 * Coeficientes alinhados com `ped_fluidos` (mesma calc no app) e POQI-11
 * (BJA 2024), que recomenda abordagem conservadora — terceiro espaço é
 * conceito controverso desde Chappell/Jacob 2008.
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

  const horasN = hours.length;
  const totalManutencao = rate * horasN;
  const totalTerceiroEspaco = tsLoss * horasN;
  const perdaInsensivel = totalManutencao + totalTerceiroEspaco;
  const totalPerdido = totalSangramento + totalDiurese + totalOutras + perdaInsensivel;
  const balancoNet = totalInfundido - totalPerdido;
  const ablRestante = Math.max(0, abl - totalSangramento);
  const metaDiureseAcumulada = goalRate * horasN;

  const alerts = [];

  if (horasN >= 3 && balancoNet > 1500) {
    alerts.push({
      level: 'warning',
      message: 'Balanço positivo > 1500 ml após 3 h — considerar restrição hídrica.',
    });
  }

  if (horasN >= 2) {
    const ultimas2 = hours.slice(-2);
    const oliguria = ultimas2.every((h) => {
      const d = num(h?.diurese);
      return d > 0 && d < goalRate;
    });
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
    alerts,
  };
}
