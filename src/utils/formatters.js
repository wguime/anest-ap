/**
 * Formatters centralizados (pt-BR) — fonte única para exibição de datas,
 * números e moeda. Substitui `.toLocaleDateString('pt-BR')` / `.toLocaleString`
 * ad-hoc espalhados pelo app (Fase 3.6 do plano DS).
 *
 * Princípio: a saída do estilo default espelha EXATAMENTE
 * `new Date(x).toLocaleDateString('pt-BR')` para que a migração seja
 * visualmente equivalente (zero regressão).
 *
 * Para COMPARAÇÃO de datas (overdue, daysUntil) use `dateUtils.js` — este
 * módulo é só apresentação. Todas as funções são puras e tolerantes a
 * entrada nula/inválida (retornam string vazia, nunca quebram o render).
 */

const LOCALE = 'pt-BR';

/** Normaliza entrada (Date | string ISO | number | null) para Date válido ou null. */
function toDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Presets de opções Intl para `formatDate`.
 * - `short`    → 15/03/2026                (default; == toLocaleDateString('pt-BR'))
 * - `numeric`  → 15/03/2026                (alias explícito de dia/mês/ano 2-dígitos)
 * - `medium`   → 15 de mar. de 2026
 * - `long`     → 15 de março de 2026
 * - `dayMonth` → 15 de mar.
 * - `weekday`  → sáb.
 * - `datetime` → 15/03/2026 14:30
 * - `time`     → 14:30
 */
const DATE_PRESETS = {
  short: undefined,
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: '2-digit', month: 'long', year: 'numeric' },
  dayMonth: { day: '2-digit', month: 'short' },
  weekday: { weekday: 'short' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
};

/**
 * Formata uma data em pt-BR. Default (`short`) é idêntico a
 * `toLocaleDateString('pt-BR')`.
 * @param {Date|string|number|null} value
 * @param {keyof typeof DATE_PRESETS | Intl.DateTimeFormatOptions} [style='short']
 * @param {string} [fallback=''] — retorno quando a data é nula/inválida
 * @returns {string}
 */
export function formatDate(value, style = 'short', fallback = '') {
  const d = toDate(value);
  if (!d) return fallback;
  if (style === 'short') return d.toLocaleDateString(LOCALE);
  const opts = typeof style === 'string' ? DATE_PRESETS[style] : style;
  if (style === 'time' || (opts && opts.hour && !opts.day)) {
    return d.toLocaleTimeString(LOCALE, opts);
  }
  return d.toLocaleDateString(LOCALE, opts);
}

/**
 * Data + hora curtas: 15/03/2026 14:30. Atalho de `formatDate(v, 'datetime')`.
 * @param {Date|string|number|null} value
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatDateTime(value, fallback = '') {
  return formatDate(value, 'datetime', fallback);
}

/**
 * Hora curta: 14:30.
 * @param {Date|string|number|null} value
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatTime(value, fallback = '') {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString(LOCALE, DATE_PRESETS.time);
}

/**
 * Número em pt-BR (separador de milhar + decimal). Espelha
 * `Number(n).toLocaleString('pt-BR', opts)`.
 * @param {number|string|null} value
 * @param {Intl.NumberFormatOptions} [options]
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatNumber(value, options, fallback = '') {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return n.toLocaleString(LOCALE, options);
}

/**
 * Moeda BRL: R$ 1.234,56.
 * @param {number|string|null} value
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatCurrency(value, fallback = '') {
  return formatNumber(value, { style: 'currency', currency: 'BRL' }, fallback);
}

/**
 * Percentual: 42,5%. Recebe o valor já em escala 0–100 (não fração).
 * @param {number|string|null} value
 * @param {number} [maximumFractionDigits=1]
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatPercent(value, maximumFractionDigits = 1, fallback = '') {
  const s = formatNumber(value, { maximumFractionDigits }, null);
  return s == null ? fallback : `${s}%`;
}

/**
 * Tempo relativo curto em pt-BR ("há 5 min", "ontem", "há 3 dias").
 * Centraliza a lógica antes duplicada em comunicadosHelpers.formatRelativeDate.
 * Acima de 7 dias cai para `formatDate(v, 'dayMonth')` (15 de mar.).
 * @param {Date|string|number|null} value
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatRelativeTime(value, fallback = '') {
  const date = toDate(value);
  if (!date) return fallback;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDate(date, 'dayMonth', fallback);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  return formatDate(date, 'dayMonth', fallback);
}
