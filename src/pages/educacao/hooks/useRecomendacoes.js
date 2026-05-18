import { useMemo } from 'react'

/**
 * useRecomendacoes — T1.5.9
 *
 * Algoritmo simples client-side (sem ML, sem backend).
 * Score por sinais:
 *  +3 se categoria === última categoria concluída pelo user
 *  +2 se obrigatório
 *  +2 se em trilha que o user já tem progresso (continuidade)
 *  +1 se liberado nos últimos 30 dias (novidade)
 *  +1 se pontosAoCompletar alto (sinal de relevância do admin)
 *
 * Filtra: ignora cursos já em_andamento ou concluido.
 * Decisão arquitetural: educação em Firestore; agregação client-side
 * a partir dos dados já em memória via useEducacaoData.
 */
export function useRecomendacoes({
  cursosComProgresso = [],
  trilhaCursosRel = [],
  progressos = [],
  limit = 4,
} = {}) {
  return useMemo(() => {
    if (!Array.isArray(cursosComProgresso) || cursosComProgresso.length === 0) {
      return []
    }

    // 1) Última categoria do que o user concluiu (mais recente)
    const concluidos = (progressos || [])
      .filter((p) => p?.status === 'concluido' || p?.status === 'aprovado')
      .slice()
      .sort((a, b) => {
        const ad = a.dataConclusao?.toMillis?.() ?? new Date(a.dataConclusao || 0).getTime()
        const bd = b.dataConclusao?.toMillis?.() ?? new Date(b.dataConclusao || 0).getTime()
        return bd - ad
      })

    let ultimaCategoria = null
    for (const p of concluidos) {
      const curso = cursosComProgresso.find((c) => c.id === p.cursoId)
      if (curso?.categoriaId || curso?.categoria) {
        ultimaCategoria = curso.categoriaId || curso.categoria
        break
      }
    }

    // 2) Trilhas em que o user já tem progresso (qualquer status)
    const cursosComProgressoIds = new Set(
      (progressos || []).map((p) => p.cursoId).filter(Boolean)
    )
    const trilhasComProgresso = new Set(
      (trilhaCursosRel || [])
        .filter((r) => cursosComProgressoIds.has(r.cursoId))
        .map((r) => r.trilhaId)
    )
    const cursosEmTrilhasAtivas = new Set(
      (trilhaCursosRel || [])
        .filter((r) => trilhasComProgresso.has(r.trilhaId))
        .map((r) => r.cursoId)
    )

    const NOW = Date.now()
    const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000

    const scored = cursosComProgresso
      .filter((c) => c.status !== 'em_andamento' && c.status !== 'concluido' && c.status !== 'aprovado')
      .map((c) => {
        let score = 0
        const cat = c.categoriaId || c.categoria
        if (ultimaCategoria && cat && cat === ultimaCategoria) score += 3
        if (c.obrigatorio) score += 2
        if (cursosEmTrilhasAtivas.has(c.id)) score += 2

        // novidade (liberado < 30d)
        const lib = c.dataLiberacao?.toMillis?.() ?? new Date(c.dataLiberacao || 0).getTime()
        if (lib && NOW - lib < TRINTA_DIAS) score += 1

        const pts = Number(c.pontosAoCompletar) || 0
        if (pts >= 50) score += 1

        return { curso: c, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map((x) => x.curso)
  }, [cursosComProgresso, trilhaCursosRel, progressos, limit])
}
