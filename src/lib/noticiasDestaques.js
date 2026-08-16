/**
 * noticiasDestaques — ordenação dos "Destaques Científicos".
 *
 * Curadoria ativa (curadoriaDestaqueAte no futuro) vem SEMPRE à frente do
 * ranking heurístico (finalScore): é o mecanismo que segura um artigo
 * indicado por um curador no topo do carrossel pelo prazo combinado,
 * independente do recompute semanal de scores.
 *
 * Funções puras — usadas por NoticiasCarousel (Home), NoticiasPage e
 * CategoriaNoticiasPage.
 */

/** Curadoria ainda vigente? (curadoriaPor setado + prazo no futuro) */
export function curadoriaAtiva(noticia, agora = new Date()) {
  if (!noticia?.curadoriaPor || !noticia?.curadoriaDestaqueAte) return false
  const ate = new Date(noticia.curadoriaDestaqueAte)
  if (isNaN(ate.getTime())) return false
  return ate.getTime() > agora.getTime()
}

/**
 * Ordena para os heros "Em destaque": curadoria ativa primeiro (mais recente
 * antes), depois finalScore desc, depois publicadoEm desc. Não muta a lista.
 */
export function ordenarDestaques(lista, agora = new Date()) {
  return [...(lista || [])].sort((a, b) => {
    const ca = curadoriaAtiva(a, agora)
    const cb = curadoriaAtiva(b, agora)
    if (ca !== cb) return ca ? -1 : 1
    const sa = a?.finalScore ?? 0
    const sb = b?.finalScore ?? 0
    if (sb !== sa) return sb - sa
    return (b?.publicadoEm || '').localeCompare(a?.publicadoEm || '')
  })
}
