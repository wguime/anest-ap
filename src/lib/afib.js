/**
 * Painel unificado de anticoagulação em Fibrilação Atrial.
 * CHA2DS2-VASc (risco tromboembólico) + HAS-BLED (risco hemorrágico).
 * Funções puras, sem React. Reutilizadas em UI + testáveis em Vitest.
 *
 * Refs clínicas:
 * - Lip GY et al. Chest 2010;137(2):263-272 (CHA2DS2-VASc original)
 * - Lip GY et al. Thromb Haemost 2010;104:1076-1088 (stroke risk % per score)
 * - Pisters R et al. Chest 2010;138(5):1093-1100 (HAS-BLED original)
 * - ESC Guidelines for AF 2020 (Hindricks G et al. Eur Heart J 2021;42:373-498)
 */

/**
 * CHA2DS2-VASc — Risco de AVC em fibrilação atrial.
 *
 * @param {Object} values — boolean flags para cada critério
 * @param {boolean} values.chf         C  — ICC / disfunção VE
 * @param {boolean} values.hypertension H — Hipertensão
 * @param {boolean} values.age75       A2 — Idade >= 75 anos
 * @param {boolean} values.diabetes    D  — Diabetes mellitus
 * @param {boolean} values.stroke      S2 — AVC / AIT / TE prévio
 * @param {boolean} values.vascular    V  — Doença vascular (IAM, DAP, placa aórtica)
 * @param {boolean} values.age65       A  — Idade 65-74 anos
 * @param {boolean} values.female      Sc — Sexo feminino
 *
 * @returns {{ score: number, maxScore: 9, strokeRiskPercent: number, recommendation: string }}
 */
export function cha2ds2vasc(values = {}) {
  let score = 0;
  if (values.chf) score += 1;
  if (values.hypertension) score += 1;
  if (values.age75) score += 2;
  if (values.diabetes) score += 1;
  if (values.stroke) score += 2;
  if (values.vascular) score += 1;
  // age75 e age65 são mutuamente exclusivos — se ≥75, não soma ponto de 65-74
  if (values.age65 && !values.age75) score += 1;
  if (values.female) score += 1;

  // Risco anual de AVC (% por ano) — Lip GY et al. Thromb Haemost 2010
  // Índice = score. Valores para scores 0-9.
  const strokeRiskTable = [0, 1.3, 2.2, 3.2, 4.0, 6.7, 9.8, 9.6, 6.7, 15.2];
  const strokeRiskPercent = strokeRiskTable[Math.min(score, 9)];

  // Recomendação conforme ESC 2020
  let recommendation;
  if (score === 0) {
    recommendation = 'Sem necessidade de anticoagulação';
  } else if (
    score === 1 &&
    values.female &&
    !values.chf &&
    !values.hypertension &&
    !values.age75 &&
    !values.diabetes &&
    !values.stroke &&
    !values.vascular &&
    !values.age65
  ) {
    // Sexo feminino como fator isolado — não confere risco independente
    recommendation = 'Considerar não anticoagular';
  } else if (score === 1) {
    recommendation = 'Considerar anticoagulação oral';
  } else {
    recommendation = 'Anticoagulação oral recomendada';
  }

  return {
    score,
    maxScore: 9,
    strokeRiskPercent,
    recommendation,
  };
}

/**
 * HAS-BLED — Risco de sangramento em pacientes com fibrilação atrial.
 *
 * @param {Object} values — boolean flags para cada critério
 * @param {boolean} values.hypertension   H — PAS > 160 mmHg
 * @param {boolean} values.renalDisease   A — Disfunção renal (diálise, Cr > 2.3 ou transplante)
 * @param {boolean} values.liverDisease   A — Disfunção hepática (cirrose, bili > 2x, TGO/TGP > 3x)
 * @param {boolean} values.stroke         S — AVC prévio
 * @param {boolean} values.bleeding       B — Sangramento prévio ou predisposição
 * @param {boolean} values.labileInr      L — INR lábil (TTR < 60%)
 * @param {boolean} values.elderly        E — Idade > 65 anos
 * @param {boolean} values.drugs          D — Antiplaquetários ou AINE concomitantes
 * @param {boolean} values.alcohol        D — Alcoolismo (>= 8 doses/semana)
 *
 * @returns {{ score: number, maxScore: 9, bleedingRisk: string, interpretation: string }}
 */
export function hasbled(values = {}) {
  let score = 0;
  if (values.hypertension) score += 1;
  if (values.renalDisease) score += 1;
  if (values.liverDisease) score += 1;
  if (values.stroke) score += 1;
  if (values.bleeding) score += 1;
  if (values.labileInr) score += 1;
  if (values.elderly) score += 1;
  if (values.drugs) score += 1;
  if (values.alcohol) score += 1;

  let bleedingRisk;
  let interpretation;
  if (score <= 2) {
    bleedingRisk = '1.0-3.7%';
    interpretation = 'Baixo risco de sangramento';
  } else {
    bleedingRisk = '>3.7%';
    interpretation = 'Alto risco — correção de fatores modificáveis';
  }

  return {
    score,
    maxScore: 9,
    bleedingRisk,
    interpretation,
  };
}

/**
 * Painel integrado de anticoagulação em FA.
 * Combina CHA2DS2-VASc + HAS-BLED para recomendação unificada.
 *
 * @param {Object} chadValues    — valores para cha2ds2vasc()
 * @param {Object} hasbledValues — valores para hasbled()
 *
 * @returns {{ chads: ReturnType<cha2ds2vasc>, hasbled: ReturnType<hasbled>, recommendation: string }}
 */
export function afibPanel(chadValues = {}, hasbledValues = {}) {
  const chads = cha2ds2vasc(chadValues);
  const hb = hasbled(hasbledValues);

  let recommendation;

  if (chads.score === 0) {
    recommendation = 'Sem indicação de anticoagulação';
  } else if (chads.score >= 2 && hb.score <= 2) {
    recommendation = 'Anticoagulação recomendada — baixo risco de sangramento';
  } else if (chads.score >= 2 && hb.score >= 3) {
    recommendation =
      'Anticoagulação recomendada — ATENÇÃO: alto risco de sangramento. Corrigir fatores modificáveis';
  } else if (chads.score === 1) {
    // Score 1 — inclui caso de sexo feminino isolado (chads.recommendation já cobre)
    const isIsolatedFemale =
      chadValues.female &&
      !chadValues.chf &&
      !chadValues.hypertension &&
      !chadValues.age75 &&
      !chadValues.diabetes &&
      !chadValues.stroke &&
      !chadValues.vascular &&
      !chadValues.age65;

    if (isIsolatedFemale) {
      recommendation = 'Sem indicação de anticoagulação';
    } else {
      recommendation = 'Considerar anticoagulação — avaliar risco-benefício com HAS-BLED';
    }
  } else {
    // Fallback defensivo (não deveria ocorrer com inputs booleanos válidos)
    recommendation = 'Avaliar individualmente';
  }

  return {
    chads,
    hasbled: hb,
    recommendation,
  };
}
