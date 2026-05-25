/**
 * SOFA / qSOFA Score — Sepsis-3 (JAMA 2016).
 * Funções puras, sem React. Reutilizadas em UI + testáveis em Vitest.
 *
 * Refs clínicas:
 * - Singer M, et al. JAMA 2016;315(8):801-810 — Third International Consensus
 *   Definitions for Sepsis and Septic Shock (Sepsis-3)
 * - Seymour CW, et al. JAMA 2016;315(8):762-774 — qSOFA validation
 * - Vincent JL, et al. Intensive Care Med 1996;22(7):707-710 — SOFA original
 */

const num = (v, fallback = null) => {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

// ============================================================================
// qSOFA — Quick Sepsis-related Organ Failure Assessment
// ============================================================================

/**
 * qSOFA — triagem rápida à beira do leito.
 *
 * @param {Object} values
 * @param {boolean} values.altMental   — GCS < 15 (true/false)
 * @param {boolean} values.frAlta      — FR >= 22 irpm (true/false)
 * @param {boolean} values.pasBaixa    — PAS <= 100 mmHg (true/false)
 *
 * @returns {{ score, maxScore, version, risk, interpretation } | null}
 */
export function qsofa(values) {
  if (!values || typeof values !== 'object') return null;

  const { altMental, frAlta, pasBaixa } = values;

  // Require at least one boolean defined
  if (altMental === undefined && frAlta === undefined && pasBaixa === undefined) {
    return null;
  }

  const score =
    (altMental ? 1 : 0) +
    (frAlta ? 1 : 0) +
    (pasBaixa ? 1 : 0);

  let risk, interpretation;

  if (score >= 2) {
    risk = 'alto';
    interpretation = 'Alto risco — investigar sepse com SOFA completo';
  } else if (score === 1) {
    risk = 'medio';
    interpretation = 'Risco intermediário — monitorar';
  } else {
    risk = 'baixo';
    interpretation = 'Baixo risco';
  }

  return {
    score,
    maxScore: 3,
    version: 'qsofa',
    risk,
    interpretation,
  };
}

// ============================================================================
// SOFA — Sequential Organ Failure Assessment (completo)
// ============================================================================

/**
 * Pontuação do componente respiratório (PaO2/FiO2).
 * @param {number} pf — razão PaO2/FiO2
 * @param {boolean} vm — ventilação mecânica
 * @returns {number} 0-4
 */
function scoreResp(pf, vm) {
  const v = num(pf);
  if (v === null || v < 0) return 0;
  if (v >= 400) return 0;
  if (v >= 300) return 1;
  if (v >= 200) return 2;
  if (v >= 100) return vm ? 3 : 2;
  return vm ? 4 : 2;
}

/**
 * Pontuação do componente coagulação (plaquetas x10³/µL).
 * @param {number} plaq — contagem de plaquetas (x10³)
 * @returns {number} 0-4
 */
function scoreCoag(plaq) {
  const v = num(plaq);
  if (v === null || v < 0) return 0;
  if (v >= 150) return 0;
  if (v >= 100) return 1;
  if (v >= 50) return 2;
  if (v >= 20) return 3;
  return 4;
}

/**
 * Pontuação do componente hepático (bilirrubina mg/dL).
 * @param {number} bili — bilirrubina total
 * @returns {number} 0-4
 */
function scoreHepatic(bili) {
  const v = num(bili);
  if (v === null || v < 0) return 0;
  if (v < 1.2) return 0;
  if (v < 2.0) return 1;
  if (v < 6.0) return 2;
  if (v < 12.0) return 3;
  return 4;
}

/**
 * Pontuação do componente cardiovascular.
 * @param {number} pam — pressão arterial média (mmHg)
 * @param {string|null} vasopressor — 'nenhum' | 'dopaBaixa' | 'dopaAlta' | 'dobutemina' | 'noraAdre_baixa' | 'noraAdre_alta' | 'dopaAltissima'
 * @returns {number} 0-4
 *
 * Escala (Sepsis-3 / Vincent 1996):
 *   0 = PAM >= 70
 *   1 = PAM < 70
 *   2 = Dopamina <= 5 µg/kg/min OU Dobutamina (qualquer dose)
 *   3 = Dopamina > 5 µg/kg/min OU Noradrenalina/Adrenalina <= 0.1 µg/kg/min
 *   4 = Dopamina > 15 µg/kg/min OU Noradrenalina/Adrenalina > 0.1 µg/kg/min
 */
function scoreCardio(pam, vasopressor) {
  // Vasopressor takes precedence over PAM when specified
  if (vasopressor && vasopressor !== 'nenhum') {
    switch (vasopressor) {
      case 'dopaBaixa':    // Dopa <= 5
      case 'dobutamina':
        return 2;
      case 'dopaAlta':     // Dopa > 5
      case 'noraAdre_baixa': // Nora/Adre <= 0.1
        return 3;
      case 'dopaAltissima':  // Dopa > 15
      case 'noraAdre_alta':  // Nora/Adre > 0.1
        return 4;
      default:
        break;
    }
  }

  const v = num(pam);
  if (v === null) return 0;
  return v >= 70 ? 0 : 1;
}

/**
 * Pontuação do componente neurológico (Glasgow).
 * @param {number} gcs — Escala de Coma de Glasgow (3-15)
 * @returns {number} 0-4
 */
function scoreNeuro(gcs) {
  const v = num(gcs);
  if (v === null || v < 3) return 0;
  if (v >= 15) return 0;
  if (v >= 13) return 1;
  if (v >= 10) return 2;
  if (v >= 6) return 3;
  return 4;
}

/**
 * Pontuação do componente renal (creatinina mg/dL, débito urinário mL/dia).
 * @param {number} cr — creatinina sérica (mg/dL)
 * @param {number|null} du — débito urinário (mL/dia), opcional
 * @returns {number} 0-4
 */
function scoreRenal(cr, du) {
  const v = num(cr);
  const urine = num(du);

  // Débito urinário pode elevar a pontuação
  if (urine !== null && urine < 200) return 4;
  if (urine !== null && urine < 500 && v !== null && v >= 3.5) return 3;

  if (v === null || v < 0) return 0;
  if (v < 1.2) return 0;
  if (v < 2.0) return 1;
  if (v < 3.5) return 2;
  if (v < 5.0) {
    // DU < 500 mL/dia eleva para 3 mesmo com Cr 3.5-4.9
    return 3;
  }
  return 4;
}

// Mortality estimates based on Ferreira FL, et al. JAMA 2001;286(14):1754-1758
const MORTALITY_BANDS = [
  { max: 1,  mortality: '<5%',    risk: 'baixo' },
  { max: 3,  mortality: '5-10%',  risk: 'baixo' },
  { max: 6,  mortality: '15-20%', risk: 'medio' },
  { max: 9,  mortality: '25-35%', risk: 'medio' },
  { max: 12, mortality: '40-50%', risk: 'alto' },
  { max: 15, mortality: '55-70%', risk: 'alto' },
  { max: 24, mortality: '>80%',   risk: 'critico' },
];

/**
 * SOFA completo — 6 sistemas orgânicos, 0-4 cada.
 *
 * @param {Object} values
 * @param {number} values.pf          — PaO2/FiO2
 * @param {boolean} values.vm         — ventilação mecânica
 * @param {number} values.plaquetas   — plaquetas x10³/µL
 * @param {number} values.bilirrubina — bilirrubina total mg/dL
 * @param {number} values.pam         — PAM mmHg
 * @param {string} values.vasopressor — tipo de vasopressor
 * @param {number} values.glasgow     — GCS (3-15)
 * @param {number} values.creatinina  — creatinina sérica mg/dL
 * @param {number} [values.diureseDay] — débito urinário mL/dia (opcional)
 *
 * @returns {{ score, maxScore, version, risk, mortality, interpretation, organScores } | null}
 */
export function sofa(values) {
  if (!values || typeof values !== 'object') return null;

  const { pf, vm, plaquetas, bilirrubina, pam, vasopressor, glasgow, creatinina, diureseDay } = values;

  // Require at least one numeric input to be defined
  if (
    num(pf) === null &&
    num(plaquetas) === null &&
    num(bilirrubina) === null &&
    num(pam) === null &&
    num(glasgow) === null &&
    num(creatinina) === null &&
    (!vasopressor || vasopressor === 'nenhum')
  ) {
    return null;
  }

  const organScores = {
    resp: scoreResp(pf, !!vm),
    coag: scoreCoag(plaquetas),
    hepatic: scoreHepatic(bilirrubina),
    cardio: scoreCardio(pam, vasopressor),
    neuro: scoreNeuro(glasgow),
    renal: scoreRenal(creatinina, diureseDay),
  };

  const score = Object.values(organScores).reduce((sum, v) => sum + v, 0);

  const band = MORTALITY_BANDS.find((b) => score <= b.max) || MORTALITY_BANDS[MORTALITY_BANDS.length - 1];

  const interpretation =
    'Sepse (Sepsis-3): infecção + aumento ≥2 pts no SOFA basal. ' +
    `Score ${score}/24 — mortalidade estimada ${band.mortality}.`;

  return {
    score,
    maxScore: 24,
    version: 'sofa',
    risk: band.risk,
    mortality: band.mortality,
    interpretation,
    organScores,
  };
}

// ============================================================================
// Comparação lado a lado
// ============================================================================

/**
 * Calcula qSOFA e SOFA para o mesmo paciente.
 *
 * @param {Object} values — union de campos qSOFA + SOFA
 * @returns {{ qsofa: Object|null, sofa: Object|null }}
 */
export function sofaCompare(values) {
  if (!values || typeof values !== 'object') return { qsofa: null, sofa: null };
  return {
    qsofa: qsofa(values),
    sofa: sofa(values),
  };
}
