/**
 * VISÃO "POR FILA" da conferência no desktop (dono 09/10/2026, modelo C escolhido em protótipo).
 *
 * A conferência de sempre agrupa as cirurgias por SALA (blocos); a fila de liberação mora
 * num cartão à parte, e conferir "quem faz o quê, nessa ordem" exigia ir e voltar entre os
 * dois. Aqui o agrupamento é o da aba Liberações do app: cada pessoa do rodapé, na ordem,
 * com as cirurgias dela embaixo — o que se confere é o que o grupo vai ver.
 *
 * Puro: recebe os casos do turno JÁ com as atribuições aplicadas (`aplicarAtribuicoes`),
 * alinhados por índice com a lista da tela — os índices devolvidos são os mesmos que a
 * edição (`setCampo`, `removeLinha`, `definirAnestesistaCaso`) usa.
 */
import { stripNotaRodape, notaDoNome } from './colunaLiberacao'

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Mesma normalização de `normNome` (utils da escala), sem importar a página. */
export const normNomeFila = (s) => semAcento(stripNotaRodape(String(s || '')))
  .replace(/^\s*ped[.\s]\s*/i, '')
  .trim()
  .toUpperCase()

const ehVazio = (t) => !t || t === '//' || /^\?+$/.test(t)

/**
 * Identidades de um caso: uma por anestesista ("A + B" é dupla — a cirurgia é das duas).
 * `herdada` é a identidade do bloco, para a linha "//" (continuação do de cima).
 */
function identidadesDoCaso(c, resolver, herdada) {
  if (c?.semAnestesista) return []
  const bruto = String(c?.anestesista || '').trim()
  if (/^\?+$/.test(bruto)) return []
  if (!bruto || bruto === '//') return herdada ? [herdada] : []
  const partes = bruto.split('+').map((p) => p.trim()).filter(Boolean)
  return partes.map((parte) => {
    const uid = (partes.length === 1 ? c?.anestesistaUserId : null) || resolver?.(parte) || null
    return { chave: uid || normNomeFila(parte), uid, nome: parte }
  })
}

/**
 * @param {object} p
 * @param {object[]} p.casos       casos do turno com atribuições aplicadas (índice = índice da tela)
 * @param {string[]} p.ordem       rodapé (`separarListaRodape(ordemTexto)`), com as notas
 * @param {string[]} [p.ajuda]     nomes marcados como ajuda
 * @param {string[]} [p.grupos]    chave de bloco de cada caso (`chavesAnestesista`) — herança do "//"
 * @param {(nome:string)=>string|null} [p.resolver]
 * @returns {{
 *   semAnestesista: number[],
 *   pessoas: Array<{ chave, uid, nome, nota, pos, papel, ajuda, indices: number[] }>,
 *   fora: Array<{ chave, uid, nome, ajuda, indices: number[] }>,
 * }}
 */
export function montarVisaoPorFila({ casos = [], ordem = [], ajuda = [], grupos = [], resolver = null } = {}) {
  const naAjuda = new Set((ajuda || []).map(normNomeFila).filter(Boolean))
  const uidsAjuda = new Set((ajuda || []).map((n) => resolver?.(stripNotaRodape(n))).filter(Boolean))
  const ehAjuda = (chave, nome) => naAjuda.has(normNomeFila(nome)) || (chave && uidsAjuda.has(chave))

  // identidade de cada bloco, para a linha "//" herdar a do primeiro com nome
  const herancaPorGrupo = new Map()
  casos.forEach((c, i) => {
    const g = grupos?.[i]
    if (!g || herancaPorGrupo.has(g)) return
    const ids = identidadesDoCaso(c, resolver, null)
    if (ids.length === 1) herancaPorGrupo.set(g, ids[0])
  })

  const total = (ordem || []).length
  const pessoas = (ordem || []).map((n, pos) => {
    const nome = stripNotaRodape(n)
    const uid = resolver?.(nome) || null
    const chave = uid || normNomeFila(nome)
    return {
      chave, uid, nome, nota: notaDoNome(n), pos,
      papel: pos === 0 ? 'plantonista' : (pos === total - 1 && total > 1 ? 'sai1' : null),
      ajuda: ehAjuda(chave, nome),
      indices: [],
    }
  })
  // a mesma pessoa pode estar duas vezes no rodapé (leitura torta): as cirurgias vão para
  // a PRIMEIRA posição, e a segunda aparece sem caso — é o sinal para corrigir a ordem
  const porChave = new Map()
  for (const p of pessoas) {
    if (!porChave.has(p.chave)) porChave.set(p.chave, p)
    const porNome = normNomeFila(p.nome)
    if (!porChave.has(porNome)) porChave.set(porNome, p)
  }

  const semAnestesista = []
  const fora = new Map()
  casos.forEach((c, i) => {
    const ids = identidadesDoCaso(c, resolver, herancaPorGrupo.get(grupos?.[i]) || null)
    if (!ids.length) {
      // "//" sem ninguém acima e "?" declarado: a cirurgia está descoberta
      if (c?.semAnestesista || ehVazio(String(c?.anestesista || '').trim())) semAnestesista.push(i)
      return
    }
    for (const id of ids) {
      const alvo = porChave.get(id.chave) || porChave.get(normNomeFila(id.nome))
      if (alvo) {
        if (!alvo.indices.includes(i)) alvo.indices.push(i)
        continue
      }
      if (!fora.has(id.chave)) {
        fora.set(id.chave, { chave: id.chave, uid: id.uid, nome: id.nome, ajuda: ehAjuda(id.chave, id.nome), indices: [] })
      }
      const f = fora.get(id.chave)
      if (!f.indices.includes(i)) f.indices.push(i)
    }
  })

  // ajuda marcada que não está na ordem e não tem caso aqui também aparece — senão some
  for (const n of ajuda || []) {
    const nome = stripNotaRodape(n)
    const uid = resolver?.(nome) || null
    const chave = uid || normNomeFila(nome)
    if (porChave.has(chave) || porChave.has(normNomeFila(nome)) || fora.has(chave)) continue
    fora.set(chave, { chave, uid, nome, ajuda: true, indices: [] })
  }

  return { semAnestesista, pessoas, fora: [...fora.values()] }
}
