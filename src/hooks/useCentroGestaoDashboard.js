/**
 * useCentroGestaoDashboard - Unified aggregation hook for Centro de Gestao Dashboard
 *
 * Consolidates data from ALL management modules:
 * - UsersManagement (users, emails, roles)
 * - DocumentsContext (documents across 6+ categories)
 * - Comunicados (announcements, read rates)
 * - Incidents (incidentes + denuncias)
 * - Autoavaliacao (ROP self-assessment)
 * - AuditoriasInterativas (audit executions)
 * - PlanosAcao (PDCA action plans)
 * - KpiData (quality indicators)
 * - Residencia (residents and schedules)
 * - Staff (hospital and consultorio staff)
 *
 * Returns a flat object with every metric the Centro de Gestao dashboard needs.
 */
import { useMemo } from 'react'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { useComunicados } from '@/contexts/ComunicadosContext'
import { useIncidents } from '@/contexts/IncidentsContext'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { useAuditoriasInterativas } from '@/contexts/AuditoriasInterativasContext'
import { usePlanosAcao } from '@/contexts/PlanosAcaoContext'
import { useKpiData } from '@/hooks/useKpiData'
import { useResidencia } from '@/hooks/useResidencia'
import { useStaff } from '@/hooks/useStaff'
import { useEducacao } from '@/hooks/useEducacao'

// ============================================================================
// CONSTANTS
// ============================================================================

const ROP_AREA_LABELS = {
  'cultura-seguranca': 'Cultura de Seguranca',
  'comunicacao': 'Comunicacao',
  'uso-medicamentos': 'Uso de Medicamentos',
  'vida-profissional': 'Vida Profissional',
  'prevencao-infeccoes': 'Prevencao de Infeccoes',
  'avaliacao-riscos': 'Avaliacao de Riscos',
}

const CATEGORY_LABELS = {
  etica: 'Etica',
  comites: 'Comites',
  auditorias: 'Auditorias',
  relatorios: 'Relatorios',
  biblioteca: 'Biblioteca',
  financeiro: 'Financeiro',
}

const PLANO_STATUS_COLORS = {
  planejamento: '#3B82F6',
  execucao: '#F59E0B',
  verificacao: '#8B5CF6',
  concluido: '#10B981',
  cancelado: '#EF4444',
}

const PLANO_STATUS_LABELS = {
  planejamento: 'Planejamento',
  execucao: 'Execucao',
  verificacao: 'Verificacao',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
}

const TENDENCIA_PT = {
  up: 'Crescente',
  down: 'Decrescente',
  stable: 'Estavel',
  up_good: 'Crescente (Positivo)',
  up_bad: 'Crescente (Negativo)',
  down_good: 'Decrescente (Positivo)',
  down_bad: 'Decrescente (Negativo)',
}

const STATUS_PT = {
  pending: 'Pendente',
  pendente: 'Pendente',
  in_review: 'Em Analise',
  investigating: 'Em Investigacao',
  em_analise: 'Em Analise',
  em_investigacao: 'Em Investigacao',
  action_required: 'Acao Requerida',
  resolved: 'Resolvido',
  closed: 'Encerrado',
  concluido: 'Concluido',
  encerrado: 'Encerrado',
  rascunho: 'Rascunho',
  em_andamento: 'Em Andamento',
  em_progresso: 'Em Progresso',
  concluida: 'Concluida',
}

// ============================================================================
// HOOK
// ============================================================================

export function useCentroGestaoDashboard() {
  // --- Data sources ---
  const usersCtx = useUsersManagement()
  const docsCtx = useDocumentsContext()
  const comunicadosCtx = useComunicados()
  const incidentsCtx = useIncidents()
  const autoavaliacaoCtx = useAutoavaliacao()
  const auditoriasCtx = useAuditoriasInterativas()
  const planosCtx = usePlanosAcao()
  const kpi = useKpiData({ ano: 2025 })
  const residenciaCtx = useResidencia()
  const staffCtx = useStaff()
  const educacaoCtx = useEducacao()

  // --- Combined loading ---
  const isLoading =
    usersCtx.loading ||
    docsCtx.isLoading ||
    comunicadosCtx.loading ||
    incidentsCtx.loading ||
    autoavaliacaoCtx.loading ||
    auditoriasCtx.loading ||
    planosCtx.loading ||
    kpi.loading ||
    residenciaCtx.estagiosLoading ||
    residenciaCtx.plantaoLoading ||
    staffCtx.staffLoading ||
    educacaoCtx.loading

  // ==========================================================================
  // USUARIOS
  // ==========================================================================

  const totalUsers = useMemo(
    () => (usersCtx.users || []).length,
    [usersCtx.users]
  )

  const activeUsers = useMemo(
    () => (usersCtx.users || []).filter((u) => u.active).length,
    [usersCtx.users]
  )

  const adminUsers = useMemo(
    () => (usersCtx.users || []).filter((u) => u.isAdmin).length,
    [usersCtx.users]
  )

  const usersByRole = useMemo(() => {
    const users = usersCtx.users || []
    const roles = usersCtx.roles || []
    return roles.map((r) => ({
      role: r.id,
      label: r.label,
      count: users.filter((u) => u.role === r.id).length,
      color: r.color,
    }))
  }, [usersCtx.users, usersCtx.roles])

  const recentAccesses = useMemo(() => {
    return [...(usersCtx.users || [])]
      .filter((u) => u.lastAccess)
      .sort((a, b) => new Date(b.lastAccess) - new Date(a.lastAccess))
      .slice(0, 10)
  }, [usersCtx.users])

  const authorizedEmailsCount = useMemo(
    () => (usersCtx.authorizedEmails || []).length,
    [usersCtx.authorizedEmails]
  )

  // ==========================================================================
  // DOCUMENTOS
  // ==========================================================================

  const allDocsList = useMemo(() => {
    const documents = docsCtx.documents || {}
    const list = []
    Object.entries(documents).forEach(([category, docs]) => {
      ;(docs || []).forEach((doc) => {
        list.push({ ...doc, _category: category })
      })
    })
    return list
  }, [docsCtx.documents])

  const totalDocuments = useMemo(() => allDocsList.length, [allDocsList])

  const archivedDocuments = useMemo(
    () => allDocsList.filter((d) => d.status === 'arquivado').length,
    [allDocsList]
  )

  const pendingDocuments = useMemo(
    () => allDocsList.filter((d) => d.status === 'pendente').length,
    [allDocsList]
  )

  const overdueDocuments = useMemo(() => {
    const today = new Date()
    return allDocsList.filter((d) => {
      if (d.status === 'arquivado') return false
      const reviewDate = d.proximaRevisao || d.proxima_revisao
      if (!reviewDate) return false
      return new Date(reviewDate) < today
    }).length
  }, [allDocsList])

  const documentsByCategory = useMemo(() => {
    const documents = docsCtx.documents || {}
    return Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
      category,
      label,
      count: (documents[category] || []).length,
    }))
  }, [docsCtx.documents])

  const documentComplianceScore = useMemo(() => {
    const activeDocs = allDocsList.filter((d) => d.status !== 'arquivado')
    if (activeDocs.length === 0) return 0
    const vigentes = activeDocs.filter(
      (d) => d.status === 'ativo' || d.status === 'vigente'
    ).length
    return Math.round((vigentes / activeDocs.length) * 100)
  }, [allDocsList])

  // ==========================================================================
  // COMUNICADOS
  // ==========================================================================

  const comunicados = comunicadosCtx.comunicados || []

  const totalComunicados = useMemo(() => comunicados.length, [comunicados])

  const comunicadosByPriority = useMemo(() => {
    const result = { alta: 0, media: 0, baixa: 0 }
    comunicados.forEach((c) => {
      const prio = (c.prioridade || 'baixa').toLowerCase()
      if (result[prio] !== undefined) {
        result[prio]++
      }
    })
    return result
  }, [comunicados])

  const avgReadRate = useMemo(() => {
    if (comunicados.length === 0) return 0
    const totalRate = comunicados.reduce((sum, c) => {
      const leituras = c.leituras || 0
      const destinatarios = c.totalDestinatarios || 0
      if (destinatarios === 0) return sum
      return sum + (leituras / destinatarios) * 100
    }, 0)
    return Math.round((totalRate / comunicados.length) * 10) / 10
  }, [comunicados])

  const unreadComunicados = useMemo(() => {
    return comunicados.filter((c) => {
      const leituras = c.leituras || 0
      const destinatarios = c.totalDestinatarios || 0
      return destinatarios > 0 && leituras < destinatarios
    }).length
  }, [comunicados])

  // ==========================================================================
  // INCIDENTES
  // ==========================================================================

  const incidentes = incidentsCtx.incidentes || []
  const denuncias = incidentsCtx.denuncias || []

  const totalIncidentes = useMemo(() => incidentes.length, [incidentes])
  const totalDenuncias = useMemo(() => denuncias.length, [denuncias])

  const incidentsByStatus = useMemo(() => {
    const result = { pendente: 0, em_analise: 0, concluido: 0 }
    incidentes.forEach((inc) => {
      const status = inc.status || ''
      if (status === 'pendente') {
        result.pendente++
      } else if (
        status === 'pending' ||
        status === 'in_review' ||
        status === 'investigating' ||
        status === 'em_analise' ||
        status === 'em_investigacao'
      ) {
        result.em_analise++
      } else if (
        status === 'resolved' ||
        status === 'closed' ||
        status === 'concluido' ||
        status === 'encerrado'
      ) {
        result.concluido++
      }
    })
    return result
  }, [incidentes])

  const incidentsBySeverity = useMemo(() => {
    const result = { near_miss: 0, leve: 0, moderado: 0, grave: 0, critico: 0 }
    incidentes.forEach((inc) => {
      const sev = inc.incidente?.severidade || inc.severidade || 'leve'
      if (result[sev] !== undefined) {
        result[sev]++
      }
    })
    return result
  }, [incidentes])

  const meanResolutionDays = useMemo(() => {
    const resolved = incidentes.filter((inc) => {
      const status = inc.status || ''
      return (
        (status === 'concluido' || status === 'encerrado' || status === 'resolved' || status === 'closed') &&
        inc.createdAt &&
        inc.updatedAt
      )
    })
    if (resolved.length === 0) return null
    const totalDays = resolved.reduce((sum, inc) => {
      const created = new Date(inc.createdAt)
      const updated = new Date(inc.updatedAt)
      return sum + (updated - created) / (1000 * 60 * 60 * 24)
    }, 0)
    return Math.round((totalDays / resolved.length) * 10) / 10
  }, [incidentes])

  const staleIncidents = useMemo(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return incidentes.filter(
      (inc) => inc.status === 'pendente' && inc.createdAt && new Date(inc.createdAt) < sevenDaysAgo
    ).length
  }, [incidentes])

  // ==========================================================================
  // AUTOAVALIACAO (ROPs)
  // ==========================================================================

  const ropProgressoGeral = useMemo(() => {
    if (typeof autoavaliacaoCtx.getProgressoGeral === 'function') {
      return autoavaliacaoCtx.getProgressoGeral()
    }
    return { total: 0, avaliados: 0, conformes: 0, parciais: 0, naoConformes: 0, percentual: 0, scoreConformidade: 0 }
  }, [autoavaliacaoCtx.getProgressoGeral])

  const ropAreaBreakdown = useMemo(() => {
    if (typeof autoavaliacaoCtx.getProgressoByArea !== 'function') {
      return []
    }
    return Object.entries(ROP_AREA_LABELS).map(([area, label]) => {
      const progresso = autoavaliacaoCtx.getProgressoByArea(area)
      return {
        area,
        label,
        progresso: progresso || { total: 0, avaliados: 0, conformes: 0, parciais: 0, naoConformes: 0, percentual: 0, scoreConformidade: 0 },
      }
    })
  }, [autoavaliacaoCtx.getProgressoByArea])

  const overdueAvaliacoes = useMemo(() => {
    if (typeof autoavaliacaoCtx.getOverdueAvaliacoes === 'function') {
      return autoavaliacaoCtx.getOverdueAvaliacoes()
    }
    return []
  }, [autoavaliacaoCtx.getOverdueAvaliacoes])

  // ==========================================================================
  // AUDITORIAS INTERATIVAS
  // ==========================================================================

  const execucoes = auditoriasCtx.execucoes || []

  const totalExecucoes = useMemo(() => execucoes.length, [execucoes])

  const execucoesByStatus = useMemo(() => {
    const result = { pendente: 0, em_andamento: 0, concluida: 0 }
    execucoes.forEach((e) => {
      const status = e.status || ''
      if (status === 'pendente' || status === 'rascunho') {
        result.pendente++
      } else if (status === 'em_andamento' || status === 'em_progresso') {
        result.em_andamento++
      } else if (status === 'concluida') {
        result.concluida++
      }
    })
    return result
  }, [execucoes])

  const avgAuditScore = useMemo(() => {
    const completed = execucoes.filter(
      (e) => e.status === 'concluida' && e.scoreConformidade != null
    )
    if (completed.length === 0) return null
    const total = completed.reduce((sum, e) => sum + (e.scoreConformidade || 0), 0)
    return Math.round((total / completed.length) * 10) / 10
  }, [execucoes])

  const overdueAuditorias = useMemo(() => {
    if (typeof auditoriasCtx.getOverdueExecucoes === 'function') {
      return auditoriasCtx.getOverdueExecucoes()
    }
    const today = new Date()
    return execucoes.filter(
      (e) => e.status !== 'concluida' && e.prazo && new Date(e.prazo) < today
    )
  }, [auditoriasCtx.getOverdueExecucoes, execucoes])

  // ==========================================================================
  // PLANOS DE ACAO (PDCA)
  // ==========================================================================

  const planos = planosCtx.planos || []

  const totalPlanos = useMemo(() => planos.length, [planos])

  const planosByStatus = useMemo(() => {
    const result = { planejamento: 0, execucao: 0, verificacao: 0, concluido: 0, cancelado: 0 }
    planos.forEach((p) => {
      const status = p.status || ''
      if (result[status] !== undefined) {
        result[status]++
      }
    })
    return result
  }, [planos])

  const taxaConclusao = useMemo(() => {
    const relevantes = planos.filter((p) => p.status !== 'cancelado')
    if (relevantes.length === 0) return 0
    const concluidos = relevantes.filter((p) => p.status === 'concluido').length
    return Math.round((concluidos / relevantes.length) * 100)
  }, [planos])

  const overduePlanos = useMemo(() => {
    if (typeof planosCtx.getOverduePlanos === 'function') {
      return planosCtx.getOverduePlanos()
    }
    const today = new Date().toISOString().split('T')[0]
    return planos.filter(
      (p) => p.prazo < today && p.status !== 'concluido' && p.status !== 'cancelado'
    )
  }, [planosCtx.getOverduePlanos, planos])

  const planosDonutData = useMemo(() => {
    return Object.entries(PLANO_STATUS_COLORS).map(([status, color]) => ({
      label: PLANO_STATUS_LABELS[status] || status,
      value: planosByStatus[status] || 0,
      color,
    }))
  }, [planosByStatus])

  // ==========================================================================
  // KPIs
  // ==========================================================================

  const kpiSummary = kpi.summary || { total: 0, conformes: 0, naoConformes: 0, semDados: 0 }

  const kpiScoreGeral = useMemo(
    () => kpiSummary.scoreGeral || 0,
    [kpiSummary]
  )

  const kpiConformes = useMemo(
    () => kpiSummary.conformes || 0,
    [kpiSummary]
  )

  const kpiNaoConformes = useMemo(
    () => kpiSummary.naoConformes || 0,
    [kpiSummary]
  )

  const topCriticos = useMemo(() => {
    const indicadores = kpi.indicadores || []
    return indicadores
      .filter(
        (ind) =>
          ind.statusAtual?.variant === 'destructive' ||
          ind.statusAtual?.variant === 'warning'
      )
      .sort((a, b) => {
        const aPriority = a.statusAtual?.variant === 'destructive' ? 0 : 1
        const bPriority = b.statusAtual?.variant === 'destructive' ? 0 : 1
        if (aPriority !== bPriority) return aPriority - bPriority
        return (a.ultimoValor ?? 999) - (b.ultimoValor ?? 999)
      })
      .slice(0, 3)
  }, [kpi.indicadores])

  const topDestaques = useMemo(() => {
    const indicadores = kpi.indicadores || []
    return indicadores
      .filter((ind) => ind.statusAtual?.variant === 'success')
      .sort((a, b) => (b.ultimoValor ?? 0) - (a.ultimoValor ?? 0))
      .slice(0, 3)
  }, [kpi.indicadores])

  // ==========================================================================
  // RESIDENCIA
  // ==========================================================================

  const residentes = residenciaCtx.residentes || []

  const totalResidentes = useMemo(() => residentes.length, [residentes])

  const residentesByAno = useMemo(() => {
    const byAno = {}
    residentes.forEach((r) => {
      const ano = r.ano || r.anoResidencia || 'N/A'
      byAno[ano] = (byAno[ano] || 0) + 1
    })
    return byAno
  }, [residentes])

  // ==========================================================================
  // STAFF
  // ==========================================================================

  const staff = staffCtx.staff || {}

  const staffHospitais = useMemo(() => {
    if (!staff.hospitais) return 0
    return Object.values(staff.hospitais).reduce(
      (sum, locationStaff) => sum + (Array.isArray(locationStaff) ? locationStaff.length : 0),
      0
    )
  }, [staff])

  const staffConsultorio = useMemo(() => {
    if (!staff.consultorio) return 0
    return Object.values(staff.consultorio).reduce(
      (sum, roleStaff) => sum + (Array.isArray(roleStaff) ? roleStaff.length : 0),
      0
    )
  }, [staff])

  const totalStaff = useMemo(
    () => staffHospitais + staffConsultorio,
    [staffHospitais, staffConsultorio]
  )

  // ==========================================================================
  // EDUCACAO CONTINUADA
  // ==========================================================================

  const totalCursos = useMemo(
    () => (educacaoCtx.cursos || []).length,
    [educacaoCtx.cursos]
  )

  const cursosEmAndamento = useMemo(
    () => educacaoCtx.statusCounts?.em_andamento || 0,
    [educacaoCtx.statusCounts]
  )

  const cursosConcluidos = useMemo(
    () => (educacaoCtx.statusCounts?.concluido || 0) + (educacaoCtx.statusCounts?.aprovado || 0),
    [educacaoCtx.statusCounts]
  )

  const taxaConclusaoEducacao = useMemo(
    () => totalCursos > 0 ? Math.round((cursosConcluidos / totalCursos) * 100) : 0,
    [totalCursos, cursosConcluidos]
  )

  const totalCertificados = useMemo(
    () => (educacaoCtx.certificados || []).length,
    [educacaoCtx.certificados]
  )

  const pontosTotaisEducacao = useMemo(
    () => educacaoCtx.pontosTotais || 0,
    [educacaoCtx.pontosTotais]
  )

  // ==========================================================================
  // LISTAS DETALHADAS (para PDF de auditoria)
  // ==========================================================================

  const usersList = useMemo(() => {
    return (usersCtx.users || []).map(u => ({
      nome: u.displayName || u.nome || u.email?.split('@')[0] || '-',
      email: u.email || '-',
      cargo: u.role || 'colaborador',
      admin: u.isAdmin ? 'Sim' : 'Nao',
      coordenador: u.isCoordenador ? 'Sim' : '-',
      ultimoAcesso: u.lastAccess ? new Date(u.lastAccess).toLocaleDateString('pt-BR') : '-',
      ativo: u.active !== false ? 'Sim' : 'Nao',
    }))
  }, [usersCtx.users])

  const documentsList = useMemo(() => {
    return allDocsList.map(d => ({
      titulo: d.titulo || d.title || '-',
      categoria: CATEGORY_LABELS[d._category] || d._category || '-',
      status: d.status || '-',
      proximaRevisao: (d.proximaRevisao || d.proxima_revisao)
        ? new Date(d.proximaRevisao || d.proxima_revisao).toLocaleDateString('pt-BR')
        : '-',
      versao: d.versao || d.version || '-',
    }))
  }, [allDocsList])

  const comunicadosList = useMemo(() => {
    return comunicados.map(c => {
      const leituras = c.leituras || 0
      const total = c.totalDestinatarios || 0
      const taxa = total > 0 ? Math.round((leituras / total) * 100) : 0
      return {
        titulo: c.titulo || '-',
        prioridade: (c.prioridade || 'baixa').charAt(0).toUpperCase() + (c.prioridade || 'baixa').slice(1),
        autor: c.autorNome || c.autor || '-',
        data: c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '-',
        leituras: `${leituras}/${total}`,
        taxa: `${taxa}%`,
      }
    })
  }, [comunicados])

  const incidentesList = useMemo(() => {
    return incidentes.map(inc => ({
      protocolo: inc.protocolo || '-',
      tipo: inc.incidente?.tipo || inc.tipo || '-',
      severidade: inc.incidente?.severidade || inc.severidade || '-',
      status: STATUS_PT[inc.status] || inc.status || '-',
      local: inc.incidente?.local || inc.local || '-',
      data: inc.createdAt ? new Date(inc.createdAt).toLocaleDateString('pt-BR') : '-',
    }))
  }, [incidentes])

  const denunciasList = useMemo(() => {
    return denuncias.map(d => ({
      protocolo: d.protocolo || '-',
      status: STATUS_PT[d.status] || d.status || '-',
      data: d.createdAt ? new Date(d.createdAt).toLocaleDateString('pt-BR') : '-',
    }))
  }, [denuncias])

  const execucoesList = useMemo(() => {
    return execucoes.map(e => ({
      titulo: e.titulo || e.checklistTitulo || '-',
      auditor: e.auditorNome || '-',
      setor: e.setorNome || e.setor || '-',
      score: e.scoreConformidade != null ? `${e.scoreConformidade}%` : '-',
      status: STATUS_PT[e.status] || e.status || '-',
      data: e.dataAuditoria
        ? new Date(e.dataAuditoria).toLocaleDateString('pt-BR')
        : e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : '-',
    }))
  }, [execucoes])

  const planosList = useMemo(() => {
    return planos.map(p => ({
      titulo: p.titulo || '-',
      responsavel: p.responsavelNome || '-',
      prazo: p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : '-',
      status: PLANO_STATUS_LABELS[p.status] || p.status || '-',
      prioridade: p.prioridade || '-',
      origem: p.tipoOrigem ? `${p.tipoOrigem}${p.origemDescricao ? ': ' + p.origemDescricao : ''}` : '-',
    }))
  }, [planos])

  const kpiIndicadores = useMemo(() => {
    return (kpi.indicadores || []).map(ind => ({
      titulo: ind.titulo || ind.nome || ind.id || '-',
      ultimoValor: ind.ultimoValor != null ? `${ind.ultimoValor}${ind.unidade || ''}` : 'S/D',
      meta: ind.meta?.raw || (ind.meta?.target != null ? `${ind.meta.target}${ind.unidade || ''}` : '-'),
      status: ind.statusAtual?.label || (ind.statusAtual?.variant === 'destructive' ? 'Critico' : ind.statusAtual?.variant === 'warning' ? 'Alerta' : ind.statusAtual?.variant === 'success' ? 'Conforme' : '-'),
      tendencia: TENDENCIA_PT[ind.tendencia] || ind.tendencia || '-',
    }))
  }, [kpi.indicadores])

  const residentesList = useMemo(() => {
    return residentes.map(r => ({
      nome: r.nome || r.displayName || '-',
      ano: String(r.ano || r.anoResidencia || '-'),
      estagio: r.estagio || r.estagioAtual || '-',
    }))
  }, [residentes])

  const staffDetalhado = useMemo(() => {
    const result = { hospitais: {}, consultorio: {} }
    if (staff.hospitais) {
      Object.entries(staff.hospitais).forEach(([local, lista]) => {
        result.hospitais[local] = (Array.isArray(lista) ? lista : []).map(s => ({
          nome: s.nome || s.displayName || '-',
        }))
      })
    }
    if (staff.consultorio) {
      Object.entries(staff.consultorio).forEach(([role, lista]) => {
        result.consultorio[role] = (Array.isArray(lista) ? lista : []).map(s => ({
          nome: s.nome || s.displayName || '-',
        }))
      })
    }
    return result
  }, [staff])

  // ==========================================================================
  // ALERTAS CRITICOS (merged from all modules)
  // ==========================================================================

  const criticalAlerts = useMemo(() => {
    const alerts = []

    // Overdue documents
    if (overdueDocuments > 0) {
      alerts.push({
        id: 'docs-overdue',
        severity: 'critical',
        message: `${overdueDocuments} documento(s) com revisao vencida`,
        route: 'gestaoDocumental',
      })
    }

    // Stale incidents (pending > 7 days)
    if (staleIncidents > 0) {
      alerts.push({
        id: 'incidents-stale',
        severity: 'warning',
        message: `${staleIncidents} incidente(s) pendente(s) ha mais de 7 dias`,
        route: 'incidentes',
      })
    }

    // Overdue auditorias
    if (overdueAuditorias.length > 0) {
      alerts.push({
        id: 'audit-overdue',
        severity: 'critical',
        message: `${overdueAuditorias.length} auditoria(s) atrasada(s)`,
        route: 'auditoriasInterativas',
      })
    }

    // Overdue planos de acao
    if (overduePlanos.length > 0) {
      alerts.push({
        id: 'planos-overdue',
        severity: 'critical',
        message: `${overduePlanos.length} plano(s) de acao atrasado(s)`,
        route: 'planosAcao',
      })
    }

    // KPIs nao conformes
    if (kpiNaoConformes > 0) {
      alerts.push({
        id: 'kpi-nao-conformes',
        severity: 'warning',
        message: `${kpiNaoConformes} indicador(es) nao conforme(s)`,
        route: 'kpis',
      })
    }

    // Overdue avaliacoes ROP
    if (overdueAvaliacoes.length > 0) {
      alerts.push({
        id: 'aval-overdue',
        severity: 'critical',
        message: `${overdueAvaliacoes.length} avaliacao(oes) ROP vencida(s)`,
        route: 'autoavaliacao',
      })
    }

    return alerts
  }, [
    overdueDocuments,
    staleIncidents,
    overdueAuditorias,
    overduePlanos,
    kpiNaoConformes,
    overdueAvaliacoes,
  ])

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isLoading,

    // Usuarios
    totalUsers,
    activeUsers,
    adminUsers,
    usersByRole,
    recentAccesses,
    authorizedEmailsCount,

    // Documentos
    totalDocuments,
    archivedDocuments,
    pendingDocuments,
    overdueDocuments,
    documentsByCategory,
    documentComplianceScore,

    // Comunicados
    totalComunicados,
    comunicadosByPriority,
    avgReadRate,
    unreadComunicados,

    // Incidentes
    totalIncidentes,
    totalDenuncias,
    incidentsByStatus,
    incidentsBySeverity,
    meanResolutionDays,
    staleIncidents,

    // Autoavaliacao
    ropProgressoGeral,
    ropAreaBreakdown,
    overdueAvaliacoes,

    // Auditorias
    totalExecucoes,
    execucoesByStatus,
    avgAuditScore,
    overdueAuditorias,

    // Planos PDCA
    totalPlanos,
    planosByStatus,
    taxaConclusao,
    overduePlanos,
    planosDonutData,

    // KPIs
    kpiScoreGeral,
    kpiConformes,
    kpiNaoConformes,
    topCriticos,
    topDestaques,

    // Residencia
    totalResidentes,
    residentesByAno,

    // Staff
    totalStaff,
    staffHospitais,
    staffConsultorio,

    // Educacao
    totalCursos,
    cursosEmAndamento,
    cursosConcluidos,
    taxaConclusaoEducacao,
    totalCertificados,
    pontosTotaisEducacao,

    // Alertas
    criticalAlerts,

    // Listas detalhadas (PDF auditoria)
    usersList,
    documentsList,
    comunicadosList,
    incidentesList,
    denunciasList,
    execucoesList,
    planosList,
    kpiIndicadores,
    residentesList,
    staffDetalhado,
  }
}

export default useCentroGestaoDashboard
