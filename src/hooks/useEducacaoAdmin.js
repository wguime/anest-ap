/**
 * useEducacaoAdmin.js
 * Hook de agregacao cross-user para dashboard administrativo de Educacao Continuada.
 *
 * Usa onSnapshot listeners para dados em tempo real (trilhas, cursos, usuarios, progresso).
 * Calcula metricas administrativas globais + colaboradoresAgrupados para drill-down.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import * as educacaoService from '@/services/educacaoService'
import { TIPOS_USUARIO, calcularDiasRestantes } from '@/pages/educacao/data/educacaoUtils'

// ---------------------------------------------------------------------------
// Helpers (extracted from ControleEducacaoPage)
// ---------------------------------------------------------------------------

function getUserName(user) {
  return (
    user.displayName ||
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.email ||
    user.id
  )
}

function deriveStatus(progresso, atrasado) {
  if (progresso === 100) return 'concluido'
  if (atrasado) return 'atrasado'
  if (progresso > 0) return 'em_andamento'
  return 'nao_iniciado'
}

// Legacy/alternative role values found in Firestore -> canonical TIPOS_USUARIO key
const ROLE_ALIASES = {
  'anestesista': 'anestesiologista',
  'médico anestesista': 'anestesiologista',
  'medico anestesista': 'anestesiologista',
  'medico': 'anestesiologista',
  'médico': 'anestesiologista',
  'medico-staff': 'anestesiologista',
  'residente': 'medico-residente',
  'médico residente': 'medico-residente',
  'medico residente': 'medico-residente',
  'tecnico': 'tec-enfermagem',
  'técnico': 'tec-enfermagem',
  'tecnico enfermagem': 'tec-enfermagem',
  'técnico enfermagem': 'tec-enfermagem',
  'téc. enfermagem': 'tec-enfermagem',
  'tec. enfermagem': 'tec-enfermagem',
  'tecnico-auxiliar': 'tec-enfermagem',
  'farmacêutico': 'farmaceutico',
  'secretária': 'secretaria',
  'administrativo': 'anestesiologista',
  'admin': 'anestesiologista',
  'administrador': 'anestesiologista',
  'colaborador': 'anestesiologista',
}

// Build reverse lookup: display label -> key (e.g. "Anestesiologista" -> "anestesiologista")
const ROLE_LABEL_TO_KEY = {}
Object.entries(TIPOS_USUARIO).forEach(([key, { label }]) => {
  const lbl = (label || '').toLowerCase()
  if (!ROLE_LABEL_TO_KEY[lbl]) ROLE_LABEL_TO_KEY[lbl] = key
})

/**
 * Normalize a role value (which may be a display label, a key, or a legacy
 * value like "Anestesista") into a canonical TIPOS_USUARIO key.
 */
function normalizeRole(role) {
  if (!role) return 'anestesiologista'
  const lower = role.toLowerCase().trim()
  // Check alias map first (overrides like colaborador -> anestesiologista)
  if (ROLE_ALIASES[lower]) return ROLE_ALIASES[lower]
  // Already a valid key?
  if (TIPOS_USUARIO[role]) return role
  // Try lowercase key
  if (TIPOS_USUARIO[lower]) return lower
  // Try reverse label lookup
  if (ROLE_LABEL_TO_KEY[lower]) return ROLE_LABEL_TO_KEY[lower]
  return 'anestesiologista'
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEducacaoAdmin({ enabled = true } = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Raw data (each updated by its own onSnapshot listener)
  const [usuarios, setUsuarios] = useState([])
  const [trilhas, setTrilhas] = useState([])
  const [cursos, setCursos] = useState([])
  const [progressosPorUsuario, setProgressosPorUsuario] = useState({})

  // Track which listeners have delivered initial data
  const readyRef = useRef({ trilhas: false, cursos: false, usuarios: false })
  const progressoUnsubs = useRef({})

  // -----------------------------------------------------------------------
  // Setup/teardown onSnapshot listeners
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return

    setLoading(true)
    setError(null)
    readyRef.current = { trilhas: false, cursos: false, usuarios: false }

    const checkReady = () => {
      const r = readyRef.current
      if (r.trilhas && r.cursos && r.usuarios) {
        setLoading(false)
      }
    }

    const handleError = (err) => {
      console.error('[useEducacaoAdmin] Listener error:', err)
      setError(err.message || 'Erro ao carregar dados de educacao')
      setLoading(false)
    }

    // 1) Trilhas listener (uses educacaoService.subscribeTrilhas)
    const unsubTrilhas = educacaoService.subscribeTrilhas(
      (data) => {
        setTrilhas(data || [])
        readyRef.current.trilhas = true
        checkReady()
      },
      handleError,
    )

    // 2) Cursos listener (uses educacaoService.subscribeCursos)
    const unsubCursos = educacaoService.subscribeCursos(
      (data) => {
        setCursos(data || [])
        readyRef.current.cursos = true
        checkReady()
      },
      handleError,
    )

    // 3) UserProfiles listener
    const unsubUsers = onSnapshot(
      collection(db, 'userProfiles'),
      (snapshot) => {
        const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setUsuarios(users)
        readyRef.current.usuarios = true
        checkReady()
      },
      handleError,
    )

    return () => {
      unsubTrilhas()
      unsubCursos()
      unsubUsers()
      // Cleanup all progress listeners
      Object.values(progressoUnsubs.current).forEach((fn) => fn())
      progressoUnsubs.current = {}
    }
  }, [enabled])

  // -----------------------------------------------------------------------
  // Per-user progress listeners (react to usuarios changes)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || usuarios.length === 0) return

    const currentIds = new Set(usuarios.map((u) => u.id))

    // Remove listeners for users no longer present
    Object.keys(progressoUnsubs.current).forEach((uid) => {
      if (!currentIds.has(uid)) {
        progressoUnsubs.current[uid]()
        delete progressoUnsubs.current[uid]
        setProgressosPorUsuario((prev) => {
          const next = { ...prev }
          delete next[uid]
          return next
        })
      }
    })

    // Add listeners for new users
    usuarios.forEach((u) => {
      if (progressoUnsubs.current[u.id]) return // already listening

      const unsub = onSnapshot(
        collection(db, 'educacao_progresso', u.id, 'cursos'),
        (snapshot) => {
          const progressos = snapshot.docs.map((d) => ({ id: d.id, cursoId: d.id, ...d.data() }))
          setProgressosPorUsuario((prev) => ({ ...prev, [u.id]: progressos }))
        },
        (err) => {
          console.warn(`[useEducacaoAdmin] Progresso listener error for ${u.id}:`, err)
          setProgressosPorUsuario((prev) => ({ ...prev, [u.id]: [] }))
        },
      )
      progressoUnsubs.current[u.id] = unsub
    })

    return () => {
      Object.values(progressoUnsubs.current).forEach((fn) => fn())
      progressoUnsubs.current = {}
    }
  }, [enabled, usuarios])

  // -----------------------------------------------------------------------
  // Enriched users
  // -----------------------------------------------------------------------
  const usuariosEnriquecidos = useMemo(() => {
    return usuarios.map((u) => {
      const progressos = progressosPorUsuario[u.id] || []
      const byCurso = new Map(progressos.map((p) => [p.cursoId || p.id, p]))
      // tipoUsuario may not exist on userProfile — derive from role field
      const tipoUsuario = normalizeRole(u.tipoUsuario || u.role)
      return { ...u, tipoUsuario, nome: getUserName(u), progressos, byCurso }
    })
  }, [usuarios, progressosPorUsuario])

  // -----------------------------------------------------------------------
  // cursosCompliance (same logic as ControleEducacaoPage lines 390-446)
  // -----------------------------------------------------------------------
  const cursosCompliance = useMemo(() => {
    return cursos.map((curso) => {
      const trilhasComCurso = trilhas.filter((t) => (t.cursos || []).includes(curso.id))
      const tiposAplicaveis = new Set()
      trilhasComCurso.forEach((t) => {
        ;(t.tiposUsuario || []).forEach((tipo) => tiposAplicaveis.add(tipo))
      })

      const obrigatoria = trilhasComCurso.some((t) => t.obrigatoria)
      const prazoConclusao = trilhasComCurso.reduce((min, t) => {
        if (t.prazoConclusao && (min === null || t.prazoConclusao < min)) return t.prazoConclusao
        return min
      }, null)
      const createdAt = trilhasComCurso[0]?.createdAt || null

      const usersApplicable = usuariosEnriquecidos.filter((u) => {
        if (tiposAplicaveis.size === 0) return true
        return tiposAplicaveis.has(u.tipoUsuario)
      })

      const usersWithStatus = usersApplicable.map((u) => {
        const p = u.byCurso.get(curso.id)
        const progresso = p?.progresso || 0
        let atrasado = false
        if (obrigatoria && prazoConclusao && createdAt && progresso < 100) {
          const dias = calcularDiasRestantes(createdAt, prazoConclusao)
          if (dias !== null && dias < 0) atrasado = true
        }
        const status = deriveStatus(progresso, atrasado)
        return { ...u, progresso, status }
      })

      const concluidos = usersWithStatus.filter((u) => u.status === 'concluido').length
      const emAndamento = usersWithStatus.filter((u) => u.status === 'em_andamento').length
      const naoIniciados = usersWithStatus.filter((u) => u.status === 'nao_iniciado').length
      const atrasados = usersWithStatus.filter((u) => u.status === 'atrasado').length
      const total = usersWithStatus.length
      const conforme = total > 0 && concluidos === total

      return {
        ...curso,
        usersWithStatus,
        concluidos,
        emAndamento,
        naoIniciados,
        atrasados,
        total,
        conforme,
        obrigatoria,
      }
    })
  }, [cursos, trilhas, usuariosEnriquecidos])

  // -----------------------------------------------------------------------
  // Metricas agregadas
  // -----------------------------------------------------------------------
  const metricas = useMemo(() => {
    const totalTreinamentos = cursos.length
    const totalConformes = cursosCompliance.filter((c) => c.conforme).length
    const taxaConformidade =
      totalTreinamentos > 0 ? Math.round((totalConformes / totalTreinamentos) * 100) : 0
    const totalAtrasados = cursosCompliance.reduce((s, c) => s + c.atrasados, 0)
    const totalConcluidos = cursosCompliance.reduce((s, c) => s + c.concluidos, 0)
    const totalEmAndamento = cursosCompliance.reduce((s, c) => s + c.emAndamento, 0)
    const totalAssignments = cursosCompliance.reduce((s, c) => s + c.total, 0)
    const taxaConclusao =
      totalAssignments > 0 ? Math.round((totalConcluidos / totalAssignments) * 100) : 0

    return {
      taxaConformidade,
      totalAtrasados,
      totalConcluidos,
      totalEmAndamento,
      totalAssignments,
      taxaConclusao,
    }
  }, [cursos, cursosCompliance])

  // -----------------------------------------------------------------------
  // Progresso por tipo de usuario
  // -----------------------------------------------------------------------
  const progressoPorTipo = useMemo(() => {
    const grupos = {}
    usuariosEnriquecidos.forEach((u) => {
      const tipo = u.tipoUsuario || 'outro'
      if (!grupos[tipo]) {
        grupos[tipo] = {
          tipo,
          label: TIPOS_USUARIO[tipo]?.label || tipo,
          cor: TIPOS_USUARIO[tipo]?.cor || '#666',
          totalUsuarios: 0,
          somaProg: 0,
          concluidos: 0,
          atrasados: 0,
          totalAtribuicoes: 0,
        }
      }
      const g = grupos[tipo]
      g.totalUsuarios++

      cursos.forEach((curso) => {
        const p = u.byCurso.get(curso.id)
        const prog = p?.progresso || 0
        g.somaProg += prog
        g.totalAtribuicoes++
        if (prog === 100) g.concluidos++
      })
    })

    return Object.values(grupos).map((g) => ({
      tipo: g.tipo,
      label: g.label,
      cor: g.cor,
      totalUsuarios: g.totalUsuarios,
      progressoMedio:
        g.totalAtribuicoes > 0 ? Math.round(g.somaProg / g.totalAtribuicoes) : 0,
      concluidos: g.concluidos,
      atrasados: g.atrasados,
    }))
  }, [usuariosEnriquecidos, cursos])

  // -----------------------------------------------------------------------
  // Top 5 cursos por completude
  // -----------------------------------------------------------------------
  const topCursos = useMemo(() => {
    return [...cursosCompliance]
      .map((c) => ({
        titulo: c.titulo,
        concluidos: c.concluidos,
        total: c.total,
        taxaCompletude: c.total > 0 ? Math.round((c.concluidos / c.total) * 100) : 0,
      }))
      .sort((a, b) => b.taxaCompletude - a.taxaCompletude)
      .slice(0, 5)
  }, [cursosCompliance])

  // -----------------------------------------------------------------------
  // Status distribution
  // -----------------------------------------------------------------------
  const statusDistribution = useMemo(() => {
    const dist = { concluido: 0, em_andamento: 0, atrasado: 0, nao_iniciado: 0 }
    cursosCompliance.forEach((c) => {
      dist.concluido += c.concluidos
      dist.em_andamento += c.emAndamento
      dist.atrasado += c.atrasados
      dist.nao_iniciado += c.naoIniciados
    })
    return dist
  }, [cursosCompliance])

  // -----------------------------------------------------------------------
  // colaboradoresAgrupados (drill-down per-user data grouped by tipo)
  // -----------------------------------------------------------------------
  const colaboradoresData = useMemo(() => {
    return usuariosEnriquecidos
      .map((u) => {
        let totalProg = 0
        let totalCursosCount = 0
        let cursosConc = 0
        let atrasado = false

        const cursosInfo = cursos.map((curso) => {
          const p = u.byCurso.get(curso.id)
          const progresso = p?.progresso || 0
          totalProg += progresso
          totalCursosCount++
          if (progresso === 100) cursosConc++

          const trilhasComCurso = trilhas.filter((t) => (t.cursos || []).includes(curso.id))
          let cursoAtrasado = false
          trilhasComCurso.forEach((t) => {
            if (t.obrigatoria && t.prazoConclusao && t.createdAt && progresso < 100) {
              const dias = calcularDiasRestantes(t.createdAt, t.prazoConclusao)
              if (dias !== null && dias < 0) {
                cursoAtrasado = true
                atrasado = true
              }
            }
          })

          return { ...curso, progresso, status: deriveStatus(progresso, cursoAtrasado) }
        })

        const progressoMedio = totalCursosCount > 0 ? Math.round(totalProg / totalCursosCount) : 0
        const status = deriveStatus(progressoMedio, atrasado)

        return { ...u, cursosInfo, progressoMedio, cursosConc, totalCursos: totalCursosCount, status, atrasado }
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }, [usuariosEnriquecidos, cursos, trilhas])

  const colaboradoresAgrupados = useMemo(() => {
    const grupos = {}
    colaboradoresData.forEach((u) => {
      const tipo = u.tipoUsuario || 'outro'
      if (!grupos[tipo]) {
        grupos[tipo] = {
          label: TIPOS_USUARIO[tipo]?.label || tipo,
          cor: TIPOS_USUARIO[tipo]?.cor || '#666',
          usuarios: [],
        }
      }
      grupos[tipo].usuarios.push(u)
    })
    return grupos
  }, [colaboradoresData])

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------
  return {
    loading,
    error,
    totalUsuarios: usuarios.length,
    totalCursos: cursos.length,
    totalTrilhas: trilhas.length,
    taxaConformidade: metricas.taxaConformidade,
    totalAtrasados: metricas.totalAtrasados,
    totalConcluidos: metricas.totalConcluidos,
    totalAssignments: metricas.totalAssignments,
    taxaConclusao: metricas.taxaConclusao,
    totalEmAndamento: metricas.totalEmAndamento,
    progressoPorTipo,
    topCursos,
    statusDistribution,
    cursosCompliance,
    colaboradoresAgrupados,
  }
}
