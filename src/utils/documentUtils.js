/**
 * documentUtils — funções puras de agregação compartilhadas entre
 * BibliotecaPage e Centro de Gestão (Wave 4 W4-6).
 *
 * Garante contagens consistentes entre as duas páginas (ISO 15489 §9.4).
 */

import {
  SUBCATEGORIA_CONFIG,
  SUBCATEGORIA_SLUGS,
  isValidSubcategoria,
} from '@/types/documents'

/**
 * Conta documentos ativos por subcategoria.
 *
 * - Ignora docs com status='arquivado' (vão para 'obsoletos' separadamente)
 * - Docs com subcategoria inválida (NULL ou fora do enum) somam em '__sem_subcategoria'
 *
 * @param {Array} docs
 * @returns {Object} { [slug]: count } com todas as 11 subcategorias + '__sem_subcategoria'
 */
export function countDocsBySubcategoria(docs) {
  const counts = Object.fromEntries(SUBCATEGORIA_SLUGS.map((s) => [s, 0]))
  counts.__sem_subcategoria = 0
  if (!Array.isArray(docs)) return counts

  for (const doc of docs) {
    if (!doc) continue
    if (doc.status?.toLowerCase?.() === 'arquivado') continue
    const sub = doc.subcategoria?.toLowerCase?.()
    if (sub && isValidSubcategoria(sub)) {
      counts[sub]++
    } else {
      counts.__sem_subcategoria++
    }
  }
  return counts
}

/**
 * Lista os documentos com subcategoria inválida (órfãos).
 * Útil para alertas admin e fila de classificação.
 *
 * @param {Array} docs
 * @returns {Array} subset dos docs sem subcategoria válida
 */
export function findOrphanDocs(docs) {
  if (!Array.isArray(docs)) return []
  return docs.filter((d) => {
    if (!d || d.status?.toLowerCase?.() === 'arquivado') return false
    const sub = d.subcategoria?.toLowerCase?.()
    return !sub || !isValidSubcategoria(sub)
  })
}

/**
 * Gera linhas para tabela de categorias (CG aba Categorias).
 * Inclui todas as 11 subcategorias mesmo com count=0.
 *
 * Quando `includeOrphans=true`, adiciona uma linha extra "Sem subcategoria"
 * com count derivado de findOrphanDocs (visibilidade do problema dos órfãos).
 */
export function buildCategoriaRows(docs, { includeOrphans = false } = {}) {
  const counts = countDocsBySubcategoria(docs)
  const rows = SUBCATEGORIA_SLUGS.map((slug) => {
    const cfg = SUBCATEGORIA_CONFIG[slug]
    return {
      id: slug,
      label: cfg.label,
      iconKey: cfg.iconKey,
      order: cfg.order,
      count: counts[slug],
    }
  })
  if (includeOrphans && counts.__sem_subcategoria > 0) {
    rows.push({
      id: '__sem_subcategoria',
      label: 'Sem subcategoria',
      iconKey: 'AlertTriangle',
      order: 99,
      count: counts.__sem_subcategoria,
      isOrphan: true,
    })
  }
  return rows
}
