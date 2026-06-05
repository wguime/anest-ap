// documentGrouping — SSOT do agrupamento de documentos por SUBCATEGORIA (11 + catch-all)
// ============================================================================
// Antes, a lógica de "agrupar por subcategoria com bucket 99 Outros" vivia só
// na BibliotecaPage. O Centro de Gestão navegava por categoria Qmentum (9) e
// docs com subcategoria fora dos 11 slugs (ex.: 'dilemas', 'trimestral' de
// Ética/Relatórios) ficavam invisíveis no filtro.
//
// Este módulo é a fonte única consumida por BibliotecaPage E pelo Centro de
// Gestão (DocumentSection), garantindo que a regra de catch-all exista em UM
// lugar. É PURO (sem React/lucide) → fácil de testar e sem dep circular.
//
// O ícone é exposto como `iconKey` (string lucide); o consumer resolve o
// componente via seu próprio ICON_MAP (mantém este módulo livre de UI).
// ============================================================================

import { SUBCATEGORIA_CONFIG } from '@/types/documents'

/**
 * Subcategorias conhecidas (os 11 slugs do SSOT). Docs ativos cuja subcategoria
 * está fora deste set (ou é nula) caem na seção catch-all "outros".
 * @type {Set<string>}
 */
export const KNOWN_SUBCATS = new Set(Object.keys(SUBCATEGORIA_CONFIG))

/**
 * Config de navegação por subcategoria: os 11 slugs do SSOT + catch-all "outros".
 * `outros` recebe order 99 para ficar sempre por último.
 */
export const CATEGORIA_CONFIG = {
  ...Object.fromEntries(
    Object.entries(SUBCATEGORIA_CONFIG).map(([slug, cfg]) => [
      slug,
      { label: cfg.label, iconKey: cfg.iconKey, order: cfg.order },
    ])
  ),
  outros: { label: '99 Outros (sem subcategoria)', iconKey: 'Archive', order: 99 },
}

/** Slug de subcategoria é um dos 11 conhecidos? */
export function isKnownSubcat(slug) {
  return KNOWN_SUBCATS.has(slug)
}

/**
 * Agrupa documentos nos buckets de subcategoria (11 + obsoletos + outros),
 * em ordem fixa (00 Modelos → 10 Obsoletos → 99 Outros).
 *
 * - `obsoletos`: vem de `archivedDocs` (status arquivado).
 * - `outros`: docs ativos cuja subcategoria não é um dos 11 conhecidos (ou é nula).
 * - demais: docs ativos cujo `subcategoria === <slug>`.
 *
 * @param {Object}   params
 * @param {Array}    params.activeDocs    - documentos ativos (status !== 'arquivado')
 * @param {Array}    params.archivedDocs  - documentos arquivados (status === 'arquivado')
 * @param {Function} [params.filterFn]    - predicado (doc, categoria, config) => boolean
 *                                           aplicado dentro de cada bucket
 * @returns {Array<{categoria: string, config: object, documentos: Array, order: number}>}
 */
export function groupBySubcategoria({ activeDocs = [], archivedDocs = [], filterFn } = {}) {
  const sorted = Object.entries(CATEGORIA_CONFIG).sort(([, a], [, b]) => a.order - b.order)

  return sorted.map(([categoria, config]) => {
    let inCategoria
    if (categoria === 'obsoletos') {
      inCategoria = archivedDocs
    } else if (categoria === 'outros') {
      inCategoria = activeDocs.filter((d) => !KNOWN_SUBCATS.has(d.subcategoria))
    } else {
      inCategoria = activeDocs.filter((d) => d.subcategoria === categoria)
    }

    const documentos = filterFn
      ? inCategoria.filter((d) => filterFn(d, categoria, config))
      : inCategoria

    return { categoria, config, documentos, order: config.order }
  })
}
