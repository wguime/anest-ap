/**
 * Indicadores de qualidade do módulo Cateter Peridural (acreditação Qmentum/ROP 5.4).
 * Funções puras computadas a partir dos dados já existentes — sem schema novo.
 */

/**
 * % de cateteres RETIRADOS dentro do limite de permanência (≤ maxHours).
 * Indicador de segurança: cateter peridural além do limite eleva risco de
 * infecção/complicação. Numerador = retirados ≤ maxHours; denominador =
 * total de retirados com datas válidas.
 *
 * Duração negativa (data_retirada < data_insercao, erro de dado) NÃO conta como
 * estouro — só conta como falha quem permaneceu > maxHours.
 *
 * @param {Array<{status?:string,dataInsercao?:string|Date,dataRetirada?:string|Date}>} cateteres
 * @param {number} [maxHours=96] limite de permanência (MAX_DURATION_HOURS)
 * @returns {{ total:number, within:number, pct:number|null }} pct é null sem dados
 */
export function computeRetiradaCompliance(cateteres, maxHours = 96) {
  const retirados = (cateteres || []).filter(
    (c) => c?.status === 'retirado' && c?.dataInsercao && c?.dataRetirada
  )
  const total = retirados.length
  if (total === 0) return { total: 0, within: 0, pct: null }

  const within = retirados.filter((c) => {
    const horas = (new Date(c.dataRetirada) - new Date(c.dataInsercao)) / 3600000
    if (Number.isNaN(horas)) return false
    return horas <= maxHours
  }).length

  return { total, within, pct: Math.round((within / total) * 100) }
}
