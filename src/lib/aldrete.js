/**
 * Aldrete Score — alta da SRPA (Sala de Recuperação Pós-Anestésica).
 * Funções puras, sem React. Reutilizáveis em UI + testáveis em Vitest.
 *
 * Refs clínicas:
 * - Aldrete JA, Kroulik D. Anesth Analg 1970;49(6):924-34 (original — 5 critérios c/ cor)
 * - Aldrete JA. J Clin Anesth 1995;7(1):89-91 (modificado — SpO2 substitui cor)
 */

const num = (v, fallback = null) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Valida que todos os 5 inputs são inteiros 0, 1 ou 2.
 * Retorna o array numérico ou null se qualquer input for inválido.
 */
function validateInputs(values, keys) {
  const valid = [0, 1, 2];
  const nums = [];
  for (const key of keys) {
    const n = num(values?.[key]);
    if (n === null || !valid.includes(n)) return null;
    nums.push(n);
  }
  return nums;
}

function interpret(score) {
  if (score >= 9) {
    return { interpretation: 'Apto para alta da SRPA', canDischarge: true };
  }
  if (score >= 7) {
    return { interpretation: 'Quase apto — reavaliar em 15-30 min', canDischarge: false };
  }
  return { interpretation: 'Continuar observação', canDischarge: false };
}

/**
 * Aldrete Modificado (1995).
 * 5 critérios: atividade, respiracao, circulacao, consciencia, spo2.
 * Cada um vale 0-2. Máximo = 10.
 *
 * @param {Object} values - { atividade, respiracao, circulacao, consciencia, spo2 }
 * @returns {{ score: number, maxScore: 10, version: 'modified', interpretation: string, canDischarge: boolean } | null}
 */
export function aldreteModified(values) {
  const keys = ['atividade', 'respiracao', 'circulacao', 'consciencia', 'spo2'];
  const nums = validateInputs(values, keys);
  if (!nums) return null;

  const score = nums.reduce((a, b) => a + b, 0);
  return {
    score,
    maxScore: 10,
    version: 'modified',
    ...interpret(score),
  };
}

/**
 * Aldrete Original / Aldrete-Kroulik (1970).
 * 5 critérios: atividade, respiracao, circulacao, consciencia, cor.
 * Cada um vale 0-2. Máximo = 10.
 *
 * @param {Object} values - { atividade, respiracao, circulacao, consciencia, cor }
 * @returns {{ score: number, maxScore: 10, version: 'original', interpretation: string, canDischarge: boolean } | null}
 */
export function aldreteOriginal(values) {
  const keys = ['atividade', 'respiracao', 'circulacao', 'consciencia', 'cor'];
  const nums = validateInputs(values, keys);
  if (!nums) return null;

  const score = nums.reduce((a, b) => a + b, 0);
  return {
    score,
    maxScore: 10,
    version: 'original',
    ...interpret(score),
  };
}

/**
 * Compara ambas as versões lado a lado.
 * Requer que `values` contenha tanto `spo2` quanto `cor`.
 *
 * @param {Object} values - { atividade, respiracao, circulacao, consciencia, spo2, cor }
 * @returns {{ modified: object|null, original: object|null }}
 */
export function aldreteCompare(values) {
  return {
    modified: aldreteModified(values),
    original: aldreteOriginal(values),
  };
}
