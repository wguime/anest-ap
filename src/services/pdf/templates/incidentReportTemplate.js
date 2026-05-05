/**
 * incidentReportTemplate.js - Incident Report PDF Template
 *
 * Generates an incident management report with:
 * - Summary by type and status
 * - Incident list with details
 * - Status distribution
 *
 * Data source: IncidentsContext (useIncidents)
 */

import {
  ANEST_COLORS,
  PAGE,
  addSectionTitle,
  drawTable,
  drawStatBox,
  checkPageBreak,
  formatDatePtBr,
} from '../pdfBranding'

/**
 * Template metadata
 */
export function getMeta() {
  return {
    title: 'Gestão de Incidentes',
    subtitle: 'Relatório de Incidentes e Denúncias - Acreditação Qmentum',
  }
}

/**
 * Render the incident report content.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - { incidentes: Array, denuncias: Array }
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { logoBase64, title } = context
  const { incidentes = [], denuncias = [] } = data

  let y = startY

  // ========================================================================
  // COMPUTE STATS
  // ========================================================================

  const totalIncidentes = incidentes.length
  const totalDenuncias = denuncias.length
  const total = totalIncidentes + totalDenuncias

  // Status counts for incidents
  const statusCounts = {}
  incidentes.forEach((inc) => {
    const st = inc.status || 'pendente'
    statusCounts[st] = (statusCounts[st] || 0) + 1
  })

  // Type counts for incidents
  const typeCounts = {}
  incidentes.forEach((inc) => {
    const tipo = inc.tipo || 'incidente'
    typeCounts[tipo] = (typeCounts[tipo] || 0) + 1
  })

  // Denuncias status counts
  const denunciaStatusCounts = {}
  denuncias.forEach((d) => {
    const st = d.status || 'pendente'
    denunciaStatusCounts[st] = (denunciaStatusCounts[st] || 0) + 1
  })

  // Buckets canônicos — incluem TODOS os valores aceitos pelo CHECK constraint
  // após migration 022_fix_incidents_security.sql (PT + EN simultâneos) +
  // aliases legados (em_investigacao, concluido) por backward-compat.
  // STATUS_BUCKETS é a fonte da verdade — se constraint mudar, atualizar aqui.
  const STATUS_BUCKETS = {
    pendentes: ['pendente', 'pending'],
    emAnalise: ['em_analise', 'em_andamento', 'in_review', 'investigating', 'action_required', 'em_investigacao'],
    resolvidos: ['resolvido', 'resolved', 'concluido'],
    encerrados: ['encerrado', 'arquivado', 'closed'],
  }
  function bucketTotal(bucketKey) {
    return STATUS_BUCKETS[bucketKey].reduce(
      (sum, st) => sum + (statusCounts[st] || 0) + (denunciaStatusCounts[st] || 0),
      0,
    )
  }
  const pendentes = bucketTotal('pendentes')
  // _emAnalise + _resolvidos: precomputed para uso em Distribuição de Status (abaixo)
  // e potencial export futuro. Underscore suppresses no-unused-vars.
  const _emAnalise = bucketTotal('emAnalise')
  const _resolvidos = bucketTotal('resolvidos') + bucketTotal('encerrados')
  void _emAnalise; void _resolvidos;

  // ========================================================================
  // SUMMARY SECTION
  // ========================================================================

  y = addSectionTitle(doc, y, 'Resumo Geral')

  const boxW = 42
  const gap = 3
  const bx = PAGE.marginLeft

  drawStatBox(doc, bx, y, boxW, String(total), 'Total Relatos', ANEST_COLORS.primaryDark)
  drawStatBox(doc, bx + boxW + gap, y, boxW, String(totalIncidentes), 'Incidentes', ANEST_COLORS.teal)
  drawStatBox(doc, bx + (boxW + gap) * 2, y, boxW, String(totalDenuncias), 'Denúncias', ANEST_COLORS.warning)
  drawStatBox(doc, bx + (boxW + gap) * 3, y, boxW, String(pendentes), 'Pendentes', ANEST_COLORS.danger)

  y += 24

  // ========================================================================
  // STATUS DISTRIBUTION
  // ========================================================================

  y = checkPageBreak(doc, y, 20, logoBase64, title)
  y = addSectionTitle(doc, y, 'Distribuição por Status')

  const STATUS_LABELS = {
    // Português (legado pré-022)
    pendente: 'Pendente',
    em_analise: 'Em Análise',
    em_andamento: 'Em Andamento',
    em_investigacao: 'Em Investigação',
    resolvido: 'Resolvido',
    concluido: 'Concluído',
    encerrado: 'Encerrado',
    arquivado: 'Arquivado',
    // Inglês (canônico após 022_fix_incidents_security.sql)
    pending: 'Pendente',
    in_review: 'Em Análise',
    investigating: 'Em Investigação',
    action_required: 'Ação Requerida',
    resolved: 'Resolvido',
    closed: 'Encerrado',
  }

  const statusCols = [
    { label: 'Status', width: 50, align: 'left' },
    { label: 'Incidentes', width: 40, align: 'center' },
    { label: 'Denúncias', width: 40, align: 'center' },
    { label: 'Total', width: 30, align: 'center' },
  ]

  const allStatuses = new Set([...Object.keys(statusCounts), ...Object.keys(denunciaStatusCounts)])
  const statusRows = Array.from(allStatuses).map((st) => {
    const incCount = statusCounts[st] || 0
    const denCount = denunciaStatusCounts[st] || 0
    return [
      STATUS_LABELS[st] || st,
      String(incCount),
      String(denCount),
      String(incCount + denCount),
    ]
  })

  y = drawTable(doc, y, statusCols, statusRows, { rowHeight: 6, fontSize: 7 })

  // ========================================================================
  // TYPE DISTRIBUTION
  // ========================================================================

  if (Object.keys(typeCounts).length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, 'Incidentes por Tipo')

    const TYPE_LABELS = {
      incidente: 'Incidente',
      quase_incidente: 'Quase-Incidente',
      near_miss: 'Near Miss',
      evento_adverso: 'Evento Adverso',
      evento_sentinela: 'Evento Sentinela',
    }

    const typeCols = [
      { label: 'Tipo', width: 80, align: 'left' },
      { label: 'Quantidade', width: 40, align: 'center' },
      { label: '% do Total', width: 40, align: 'center' },
    ]

    const typeRows = Object.entries(typeCounts).map(([tipo, count]) => [
      TYPE_LABELS[tipo] || tipo,
      String(count),
      totalIncidentes > 0 ? `${Math.round((count / totalIncidentes) * 100)}%` : '0%',
    ])

    y = drawTable(doc, y, typeCols, typeRows, { rowHeight: 6, fontSize: 7 })
  }

  // ========================================================================
  // INCIDENTS LIST
  // ========================================================================

  if (incidentes.length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, `Lista de Incidentes (${incidentes.length})`)

    const listCols = [
      { label: 'Protocolo', width: 30, align: 'left' },
      { label: 'Tipo', width: 30, align: 'left' },
      { label: 'Descrição', width: 60, align: 'left' },
      { label: 'Status', width: 25, align: 'center' },
      { label: 'Data', width: 25, align: 'center' },
    ]

    // Limit to 50 for PDF sanity
    const listRows = incidentes.slice(0, 50).map((inc) => {
      const descricao = inc.incidente_data?.descricao ||
                        inc.denuncia_data?.descricao ||
                        inc.descricao ||
                        '-'

      return [
        inc.protocolo || inc.tracking_code || '-',
        inc.tipo || '-',
        descricao.length > 60 ? descricao.substring(0, 57) + '...' : descricao,
        STATUS_LABELS[inc.status] || inc.status || '-',
        formatDatePtBr(inc.created_at || inc.createdAt),
      ]
    })

    y = drawTable(doc, y, listCols, listRows, { rowHeight: 5.5, fontSize: 6 })
  }

  // ========================================================================
  // DENUNCIAS LIST
  // ========================================================================

  if (denuncias.length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 20, logoBase64, title)
    y = addSectionTitle(doc, y, `Lista de Denúncias (${denuncias.length})`)

    const denCols = [
      { label: 'Protocolo', width: 30, align: 'left' },
      { label: 'Descrição', width: 80, align: 'left' },
      { label: 'Status', width: 30, align: 'center' },
      { label: 'Data', width: 30, align: 'center' },
    ]

    const denRows = denuncias.slice(0, 30).map((d) => {
      const descricao = d.denuncia_data?.descricao || d.descricao || '-'

      return [
        d.protocolo || d.tracking_code || '-',
        descricao.length > 80 ? descricao.substring(0, 77) + '...' : descricao,
        STATUS_LABELS[d.status] || d.status || '-',
        formatDatePtBr(d.created_at || d.createdAt),
      ]
    })

    y = drawTable(doc, y, denCols, denRows, { rowHeight: 5.5, fontSize: 6 })
  }
}

export default { getMeta, render }
