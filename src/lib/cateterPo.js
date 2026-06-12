/**
 * Cateter Peridural — cálculo do dia de pós-operatório (PO) a partir de datas.
 *
 * Antes, dia_po era sequencial cego (max(diaPo)+1): contava avaliações, não
 * calendário. Como o mesmo cateter pode ser avaliado mais de uma vez no mesmo
 * dia, e dias podem ser pulados, o número do PO passa a ser DERIVADO da data:
 * diferença em dias de calendário entre a data da avaliação e a data de inserção.
 *
 * Convenção clínica:
 *   - avaliação no mesmo dia da inserção → PO0 (dia da inserção / cirurgia)
 *   - dia seguinte                       → 1º PO
 *   - N dias depois                      → Nº PO
 *
 * A contagem é por dia de calendário LOCAL (ignora a hora). Para ser imune a
 * horário de verão, normalizamos cada data para a meia-noite UTC dos seus
 * componentes locais (Y/M/D) — meia-noites UTC distam exatamente 24h, então a
 * subtração nunca erra por causa de uma transição de DST no meio do intervalo.
 */

function toLocalMidnightUTC(value) {
  // new Date(null) coage para a epoch (1970) em vez de Invalid — barrar antes.
  if (value == null || value === '') return NaN
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return NaN
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Número do PO derivado das datas. Inteiro >= 0, ou null se inválido
 * (datas ausentes/inválidas ou avaliação anterior à inserção).
 *
 * @param {Date|string} dataAvaliacao
 * @param {Date|string} dataInsercao
 * @returns {number|null}
 */
export function computeDiaPo(dataAvaliacao, dataInsercao) {
  const av = toLocalMidnightUTC(dataAvaliacao)
  const ins = toLocalMidnightUTC(dataInsercao)
  if (Number.isNaN(av) || Number.isNaN(ins)) return null
  const dias = Math.round((av - ins) / 86400000)
  if (dias < 0) return null // avaliação antes da inserção: inválido
  return dias
}

/**
 * Rótulo de exibição do PO. PO0 (dia da inserção) é distinto dos demais por
 * ser o dia da cirurgia, não uma evolução pós-operatória propriamente dita.
 *
 * @param {number|null} diaPo
 * @returns {string}
 */
export function formatDiaPoLabel(diaPo) {
  if (diaPo == null || Number.isNaN(diaPo)) return '—'
  if (diaPo <= 0) return 'Dia 0 (inserção)'
  return `${diaPo}º PO`
}
