/**
 * Confidentiality labels — Onda1-4
 *
 * 4 níveis (publico < interno < restrito < sigiloso). Helpers para mapping
 * entre o ENUM Postgres (snake) e nome legível em pt-BR, além de cor de
 * badge no Design System.
 */

export const CONFIDENTIALITY_LEVELS = ['publico', 'interno', 'restrito', 'sigiloso'];

export const CONFIDENTIALITY_LABELS = {
  publico: 'Público',
  interno: 'Interno',
  restrito: 'Restrito',
  sigiloso: 'Sigiloso',
};

/**
 * Cor semântica do Design System para o badge de cada nível.
 * - publico:  success  (verde, livre acesso)
 * - interno:  info     (azul, padrão)
 * - restrito: warning  (laranja, atenção)
 * - sigiloso: destructive (vermelho, máximo sigilo)
 */
export const CONFIDENTIALITY_COLORS = {
  publico: 'success',
  interno: 'info',
  restrito: 'warning',
  sigiloso: 'destructive',
};

const CONFIDENTIALITY_NUMERIC = {
  publico: 0,
  interno: 1,
  restrito: 2,
  sigiloso: 3,
};

/**
 * @param {string} level
 * @returns {string} nome do variant DS (success/info/warning/destructive)
 */
export function getConfidentialityColor(level) {
  return CONFIDENTIALITY_COLORS[level] || CONFIDENTIALITY_COLORS.interno;
}

/**
 * @param {string} level
 * @returns {string} rótulo legível pt-BR
 */
export function getConfidentialityLabel(level) {
  return CONFIDENTIALITY_LABELS[level] || CONFIDENTIALITY_LABELS.interno;
}

/**
 * Compara níveis: retorna true se userClearance permite ler doc com docLevel.
 * @param {string} userClearance
 * @param {string} docLevel
 * @returns {boolean}
 */
export function canAccessConfidentiality(userClearance, docLevel) {
  const u = CONFIDENTIALITY_NUMERIC[userClearance] ?? CONFIDENTIALITY_NUMERIC.interno;
  const d = CONFIDENTIALITY_NUMERIC[docLevel] ?? CONFIDENTIALITY_NUMERIC.interno;
  return u >= d;
}

/**
 * Opções para Select do Design System.
 */
export const CONFIDENTIALITY_OPTIONS = CONFIDENTIALITY_LEVELS.map((value) => ({
  value,
  label: CONFIDENTIALITY_LABELS[value],
}));
