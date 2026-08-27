/**
 * Correções eletrolíticas para uso clínico em anestesiologia.
 * Funções puras, sem React. Reutilizadas em UI + testáveis em Vitest.
 *
 * Refs clínicas:
 * - Hillier TA, Abbott RD, Barrett EJ. Am J Med 1999;106(4):399-403
 *   (fator de correção 2.4 mEq/L por 100 mg/dL de glicose)
 * - Katz MA. N Engl J Med 1973;289(16):843-844
 *   (fator de correção original 1.6 mEq/L por 100 mg/dL)
 * - Iolascon A et al. Kidney Int 2022;102(4):933-941
 *   (confirma Hillier 2.4 como mais acurado em TODOS os níveis de glicose,
 *   não apenas > 400 mg/dL como se pensava anteriormente)
 * - Payne RB et al. Br Med J 1973;4(5893):643-646
 *   (correção de cálcio pela albumina: Ca + 0.8 × (4.0 - Alb))
 *
 * IMPORTANTE: Hillier 2.4 é hoje universalmente recomendado como padrão.
 * A abordagem antiga (Katz para glicose < 400, Hillier para > 400)
 * subestima o Na real na CAD e foi abandonada após Iolascon 2022.
 */

const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

// ---------------------------------------------------------------------------
// Sódio corrigido
// ---------------------------------------------------------------------------

/**
 * Sódio corrigido pela fórmula de Hillier (1999) — PADRÃO ATUAL.
 *
 * Na_corrigido = Na_medido + 2.4 × ((glicose - 100) / 100)
 *
 * Universalmente recomendado para TODOS os níveis de glicose
 * (Iolascon et al., Kidney Int 2022).
 *
 * @param {number|string} naMeasured  Sódio medido (mEq/L)
 * @param {number|string} glucoseMgDl Glicose sérica (mg/dL)
 * @returns {{ corrected: number, correction: number, formula: string, factor: number } | null}
 *   null se inputs inválidos (NaN, negativo)
 */
export function sodiumCorrectedHillier(naMeasured, glucoseMgDl) {
  const na = num(naMeasured, NaN);
  const glu = num(glucoseMgDl, NaN);
  if (!Number.isFinite(na) || !Number.isFinite(glu)) return null;
  if (na < 0 || glu < 0) return null;

  const correction = 2.4 * ((glu - 100) / 100);
  const corrected = na + correction;

  return {
    corrected: Math.round(corrected * 10) / 10,
    correction: Math.round(correction * 10) / 10,
    formula: 'Hillier',
    factor: 2.4,
  };
}

/**
 * Sódio corrigido pela fórmula de Katz (1973) — LEGADO / referência histórica.
 *
 * Na_corrigido = Na_medido + 1.6 × ((glicose - 100) / 100)
 *
 * Mantida para comparação. Para decisão clínica, preferir Hillier 2.4.
 *
 * @param {number|string} naMeasured  Sódio medido (mEq/L)
 * @param {number|string} glucoseMgDl Glicose sérica (mg/dL)
 * @returns {{ corrected: number, correction: number, formula: string, factor: number } | null}
 */
export function sodiumCorrectedKatz(naMeasured, glucoseMgDl) {
  const na = num(naMeasured, NaN);
  const glu = num(glucoseMgDl, NaN);
  if (!Number.isFinite(na) || !Number.isFinite(glu)) return null;
  if (na < 0 || glu < 0) return null;

  const correction = 1.6 * ((glu - 100) / 100);
  const corrected = na + correction;

  return {
    corrected: Math.round(corrected * 10) / 10,
    correction: Math.round(correction * 10) / 10,
    formula: 'Katz',
    factor: 1.6,
  };
}

/**
 * Retorna ambas as correções (Hillier e Katz) para comparação lado a lado.
 *
 * @param {number|string} naMeasured  Sódio medido (mEq/L)
 * @param {number|string} glucoseMgDl Glicose sérica (mg/dL)
 * @returns {{ hillier: object|null, katz: object|null }}
 */
export function sodiumCorrectedBoth(naMeasured, glucoseMgDl) {
  return {
    hillier: sodiumCorrectedHillier(naMeasured, glucoseMgDl),
    katz: sodiumCorrectedKatz(naMeasured, glucoseMgDl),
  };
}

/**
 * Interpretação clínica do nível de sódio sérico.
 *
 * Faixas baseadas em:
 * - Spasovski G et al. Eur J Endocrinol 2014 (guidelines hiponatremia)
 * - Adrogué HJ, Madias NE. N Engl J Med 2000 (hipernatremia)
 *
 * @param {number|string} naValue Sódio sérico (mEq/L)
 * @returns {{ risk: string, label: string, description?: string } | null}
 */
// ⚠️ Os cortes são FRACIONÁRIOS (`< 130`), não inteiros (`<= 129`): o sódio
// corrigido é uma soma com 2,4 × ((glicose − 100) / 100) e quase nunca cai em
// inteiro. Com corte inteiro, 129,28 escapava de "moderada" para "leve" — e a
// faixa é o que decide a conduta.
export function interpretSodium(naValue) {
  const na = num(naValue, NaN);
  if (!Number.isFinite(na)) return null;

  if (na < 120) {
    return {
      band: 'hipo_grave',
      risk: 'critico',
      label: 'Hiponatremia grave',
      description: 'Risco de edema cerebral',
    };
  }
  if (na < 130) {
    return { band: 'hipo_moderada', risk: 'alto', label: 'Hiponatremia moderada' };
  }
  if (na < 135) {
    return { band: 'hipo_leve', risk: 'medio', label: 'Hiponatremia leve' };
  }
  if (na <= 145) {
    return { band: 'normal', risk: 'baixo', label: 'Normal' };
  }
  if (na <= 150) {
    return { band: 'hiper_leve', risk: 'medio', label: 'Hipernatremia leve' };
  }
  // > 150
  return {
    band: 'hiper_significativa',
    risk: 'alto',
    label: 'Hipernatremia significativa',
    description: 'Risco de desidratação celular e alteração neurológica',
  };
}

// ---------------------------------------------------------------------------
// Cálcio corrigido
// ---------------------------------------------------------------------------

/**
 * Cálcio corrigido pela fórmula de Payne (1973).
 *
 * Ca_corrigido = Ca_medido + 0.8 × (4.0 - albumina)
 *
 * ATENÇÃO: Esta correção é IMPRECISA quando:
 * - Albumina < 2.5 g/dL (estados de perda proteica grave)
 * - Doença renal crônica avançada (DRC estágio 4-5)
 * - Alterações ácido-base significativas (pH afeta ligação Ca-albumina)
 * Nesses cenários, preferir dosagem de cálcio ionizado (iCa).
 *
 * @param {number|string} caTotalMgDl  Cálcio total sérico (mg/dL)
 * @param {number|string} albuminGdL   Albumina sérica (g/dL)
 * @returns {{ corrected: number, correction: number, formula: string } | null}
 */
export function calciumCorrectedPayne(caTotalMgDl, albuminGdL) {
  const ca = num(caTotalMgDl, NaN);
  const alb = num(albuminGdL, NaN);
  if (!Number.isFinite(ca) || !Number.isFinite(alb)) return null;
  if (ca < 0 || alb < 0) return null;

  const correction = 0.8 * (4.0 - alb);
  const corrected = ca + correction;

  return {
    corrected: Math.round(corrected * 10) / 10,
    correction: Math.round(correction * 10) / 10,
    formula: 'Payne',
  };
}

/**
 * Interpretação clínica do nível de cálcio total sérico.
 *
 * Faixas baseadas em:
 * - Bushinsky DA, Monk RD. Lancet 1998 (hipercalcemia)
 * - Cooper MS, Gittoes NJ. BMJ 2008 (hipocalcemia)
 *
 * @param {number|string} caValue Cálcio total (mg/dL)
 * @returns {{ risk: string, label: string, description?: string } | null}
 */
// ⚠️ Como no sódio, os cortes são fracionários: normal começa em 8,5, então
// 8,45 é hipocalcemia — com `<= 8.4` era classificado como normal.
// A faixa de CRISE (> 14) é separada da hipercalcemia moderada porque muda a
// conduta: crise é emergência, não achado laboratorial.
export function interpretCalcium(caValue) {
  const ca = num(caValue, NaN);
  if (!Number.isFinite(ca)) return null;

  if (ca < 7.0) {
    return {
      band: 'hipo_grave',
      risk: 'critico',
      label: 'Hipocalcemia grave',
      description: 'Risco de tetania, convulsões',
    };
  }
  if (ca < 8.5) {
    return { band: 'hipo', risk: 'alto', label: 'Hipocalcemia' };
  }
  if (ca <= 10.5) {
    return { band: 'normal', risk: 'baixo', label: 'Normal' };
  }
  if (ca <= 12.0) {
    return { band: 'hiper_leve', risk: 'medio', label: 'Hipercalcemia leve' };
  }
  if (ca <= 14.0) {
    return {
      band: 'hiper_moderada',
      risk: 'alto',
      label: 'Hipercalcemia moderada',
      description: 'Risco de arritmia',
    };
  }
  // > 14.0
  return {
    band: 'crise',
    risk: 'critico',
    label: 'Crise hipercalcêmica',
    description: 'Emergência — risco de arritmia e coma',
  };
}
