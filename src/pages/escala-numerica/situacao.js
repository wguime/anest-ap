/**
 * Situação de uma linha da numérica no turno — UMA regra para a tela, a folha impressa e a
 * contagem de quem trabalha (dono 07/10: "linha pintada + badge com nome (férias, P1, P2...)" e,
 * abaixo do HRO e da Unimed, "a quantidade de pessoas trabalhando naquele hospital naquele turno
 * (excluir: pessoas em férias, pós plantão)").
 *
 * - `ferias`: férias no Pega Plantão — fica na posição, não trabalha.
 * - `ausente`: licença no Pega Plantão ("LICENÇA SAÚDE"…) — idem; a tela diz só "ausente",
 *   nunca o motivo, que é dado de saúde (dono 07/10, LGPD).
 * - `pos`: fez a noite da véspera (P1 HRO / P2 Unimed) — à tarde fica na posição, não trabalha.
 * - `noite`: o mesmo plantonista DE MANHÃ — trabalha, na 2ª posição do hospital do plantão.
 *
 * Linha PINTADA = fora do turno = fora da contagem. A da manhã (`noite`) só leva o selo, porque
 * trabalha.
 */
export function situacao(p) {
  if (p.ferias?.length) return 'ferias'
  if (p.ausente) return 'ausente'
  if (p.posPlantao) return 'pos'
  if (p.movidoPorPlantao && p.postoPlantao) return 'noite'
  return null
}

/**
 * Texto do selo, em três larguras: `tela` (coluna de 183px — "férias", "pós P2", "P1", como o
 * dono pediu), `curto` (folha deitada do dia inteiro) e o longo (folha em pé de um turno, que
 * tem largura para dizer por extenso).
 */
export function rotuloSituacao(p, { tela = false, curto = false } = {}) {
  const s = situacao(p)
  if (s === 'ferias') return 'férias'
  if (s === 'ausente') return 'ausente'
  if (s === 'pos') {
    if (!p.postoPlantao) return 'pós plantão'
    return tela || curto ? `pós ${p.postoPlantao}` : `pós-plantão ${p.postoPlantao}`
  }
  if (s === 'noite') {
    if (tela) return p.postoPlantao
    return curto ? `${p.postoPlantao} · noite` : `plantão ${p.postoPlantao} · noite`
  }
  return null
}

/**
 * Quem está NA lista: o lugar vago de quem subiu para o P1/P2 em outro card (dono 07/10) só
 * aponta para onde a pessoa foi — não é ninguém ali.
 */
export const naLista = (lista = []) => lista.filter((p) => !p.lugarVago)

/** Quantos trabalham no turno: a lista menos férias, ausentes e pós-plantão (o lugar vago não conta). */
export function contarTrabalhando(lista = []) {
  const reais = naLista(lista)
  const de = (s) => reais.filter((p) => situacao(p) === s).length
  const ferias = de('ferias'), ausente = de('ausente'), pos = de('pos')
  return { total: reais.length, ferias, ausente, pos, trabalhando: reais.length - ferias - ausente - pos }
}
