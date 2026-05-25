/**
 * Cálculos de reposição volêmica em queimados (Parkland).
 * Funções puras, sem React. Reutilizadas em UI + testáveis em Vitest.
 *
 * Refs clínicas:
 * - ISBI Practice Guidelines for Burn Care. Burns 2016;42:953–1021
 *   → Redução de 4 → 2 mL/kg/%SCQ por evidência de "fluid creep"
 *     (ARDS, síndrome compartimental abdominal com volumes excessivos)
 * - ABA (American Burn Association) Guidelines 2024
 *   → Confirma 2 mL/kg como estimativa inicial; titular conforme diurese
 * - Baxter CR. Fluid volume and electrolyte changes of the early
 *   postburn period. Clin Plast Surg 1974;1:693–703 (fórmula original 4 mL)
 * - Holliday MA, Segar WE. Pediatrics 1957 (manutenção pediátrica)
 *
 * IMPORTANTE — Uso clínico:
 *   Estas fórmulas são ESTIMATIVAS INICIAIS. O volume real deve ser
 *   titulado conforme débito urinário (0,5 mL/kg/h adulto, 1 mL/kg/h
 *   pediátrico), perfusão periférica e parâmetros hemodinâmicos.
 *   Ferramenta auxiliar — NÃO substitui julgamento clínico.
 *
 *   A fórmula de Baxter (4 mL/kg) é mantida apenas para referência
 *   histórica. O padrão atual (ISBI 2016 / ABA 2024) é 2 mL/kg.
 *
 * Fluido recomendado: Ringer Lactato (RL).
 */

const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Manutenção diária pediátrica — Holliday-Segar (mL/24h).
 *   ≤ 10 kg  → 100 mL/kg/dia
 *   10–20 kg → 1000 + 50 × (peso − 10)
 *   > 20 kg  → 1500 + 20 × (peso − 20)
 *
 * Adicionada ao volume de Parkland para crianças < 30 kg, pois a
 * fórmula de Parkland cobre apenas perdas pela queimadura, não as
 * necessidades basais de manutenção.
 *
 * @param {number} weightKg - Peso em kg
 * @returns {number} Volume de manutenção em mL/24h
 */
export function hollidaySegarDaily(weightKg) {
  const w = num(weightKg);
  if (w <= 0) return 0;
  if (w <= 10) return w * 100;
  if (w <= 20) return 1000 + (w - 10) * 50;
  return 1500 + (w - 20) * 20;
}

/**
 * Cálculo genérico de Parkland com coeficiente configurável.
 *
 * Fórmula: coef × peso(kg) × %SCQ
 *
 * Distribuição temporal:
 *   - 50% nas primeiras 8h A PARTIR DA QUEIMADURA (não da admissão)
 *   - 50% nas 16h seguintes
 *
 * Se hoursElapsed > 0: ajusta o volume remanescente das primeiras 8h
 * proporcionalmente ao tempo restante, mantendo o volume total correto.
 *
 * Para pediátricos (peso < 30 kg): adiciona manutenção Holliday-Segar
 * ao volume total, distribuída uniformemente nas 24h.
 *
 * @param {number} weightKg     - Peso em kg
 * @param {number} scqPercent   - Superfície corporal queimada (%)
 * @param {number} hoursElapsed - Horas desde a queimadura (0–24)
 * @param {number} coef         - Coeficiente da fórmula (2 = ISBI, 4 = Baxter)
 * @returns {Object|null} Volumes e taxas calculadas, ou null se inputs inválidos
 */
function parklandCalc(weightKg, scqPercent, hoursElapsed, coef) {
  const w = num(weightKg);
  const scq = num(scqPercent);
  const elapsed = Math.max(0, Math.min(24, num(hoursElapsed)));

  // Rejeitar inputs fisiologicamente inválidos
  if (w <= 0 || scq <= 0 || scq > 100) return null;

  const isPediatric = w < 30;

  // --- Volume de Parkland (queimadura apenas) ---
  const volume24h = coef * w * scq;
  const volume8h = volume24h * 0.5;
  const volume16h = volume24h * 0.5;

  // --- Manutenção pediátrica (24h) ---
  const maintenancePed24h = isPediatric ? hollidaySegarDaily(w) : 0;

  // --- Volume total (Parkland + manutenção se pediátrico) ---
  const totalWithMaintenance = volume24h + maintenancePed24h;

  // --- Taxas ideais (sem ajuste por tempo decorrido) ---
  const rateFirst8h = volume8h / 8;
  const rateNext16h = volume16h / 16;

  // --- Ajuste para tempo decorrido ---
  let adjustedRate8h;
  let hoursRemaining8h;

  if (elapsed >= 8) {
    // Período de 8h já completo
    adjustedRate8h = 0;
    hoursRemaining8h = 0;
  } else {
    hoursRemaining8h = 8 - elapsed;
    // Volume já deveria ter sido infundido nas horas decorridas
    const volumeAlreadyDue = rateFirst8h * elapsed;
    // Volume remanescente das primeiras 8h
    const volumeRemaining8h = volume8h - volumeAlreadyDue;
    // Nova taxa para completar o restante no tempo restante
    adjustedRate8h = hoursRemaining8h > 0 ? volumeRemaining8h / hoursRemaining8h : 0;
  }

  // --- Meta de diurese ---
  const urineGoalMlKgH = isPediatric ? 1 : 0.5;
  const urineGoalMlH = w * urineGoalMlKgH;

  return {
    volume24h,
    volume8h,
    volume16h,
    rateFirst8h,
    rateNext16h,
    adjustedRate8h,
    hoursRemaining8h,
    maintenancePed24h,
    totalWithMaintenance,
    urineGoalMlKgH,
    urineGoalMlH,
    isPediatric,
    coef,
  };
}

/**
 * Reposição volêmica em queimados — ISBI 2016 / ABA 2024 (PADRÃO ATUAL).
 *
 * Fórmula: 2 mL × peso(kg) × %SCQ
 *
 * A ISBI 2016 reduziu o coeficiente de 4 para 2 mL/kg/%SCQ após
 * evidência de que volumes excessivos ("fluid creep") causam:
 *   - ARDS (síndrome do desconforto respiratório agudo)
 *   - Síndrome compartimental abdominal
 *   - Edema excessivo de tecidos não queimados
 *
 * A ABA 2024 confirma 2 mL/kg como estimativa inicial, enfatizando
 * titulação guiada por débito urinário.
 *
 * Fluido: Ringer Lactato.
 *
 * @param {number} weightKg     - Peso em kg
 * @param {number} scqPercent   - Superfície corporal queimada (%)
 * @param {number} hoursElapsed - Horas desde a queimadura (0–24)
 * @returns {Object|null} Volumes e taxas, ou null se inputs inválidos
 */
export function parklandISBI(weightKg, scqPercent, hoursElapsed = 0) {
  return parklandCalc(weightKg, scqPercent, hoursElapsed, 2);
}

/**
 * Reposição volêmica em queimados — Baxter 1968 (LEGADO).
 *
 * Fórmula: 4 mL × peso(kg) × %SCQ
 *
 * ⚠️  FÓRMULA HISTÓRICA — NÃO é o padrão atual.
 * Mantida para referência e comparação educacional.
 * Utilizar parklandISBI() para prática clínica atual.
 *
 * @param {number} weightKg     - Peso em kg
 * @param {number} scqPercent   - Superfície corporal queimada (%)
 * @param {number} hoursElapsed - Horas desde a queimadura (0–24)
 * @returns {Object|null} Volumes e taxas, ou null se inputs inválidos
 */
export function parklandBaxter(weightKg, scqPercent, hoursElapsed = 0) {
  return parklandCalc(weightKg, scqPercent, hoursElapsed, 4);
}

/**
 * Conveniência: retorna ambos os cálculos (ISBI + Baxter) lado a lado.
 *
 * @param {number} weightKg     - Peso em kg
 * @param {number} scqPercent   - Superfície corporal queimada (%)
 * @param {number} hoursElapsed - Horas desde a queimadura (0–24)
 * @returns {{ isbi: Object|null, baxter: Object|null }}
 */
export function parklandBoth(weightKg, scqPercent, hoursElapsed = 0) {
  return {
    isbi: parklandISBI(weightKg, scqPercent, hoursElapsed),
    baxter: parklandBaxter(weightKg, scqPercent, hoursElapsed),
  };
}
