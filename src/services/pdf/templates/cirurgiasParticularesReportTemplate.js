/**
 * cirurgiasParticularesReportTemplate.js - Relatório de Cirurgias Particulares
 *
 * Relatório de cobrança por período (conferência/auditoria):
 * - Stat boxes (total R$, pagas, pendentes, glosadas)
 * - Tabela completa das cirurgias do filtro (paginada — SEM truncar:
 *   é relatório de cobrança, cada linha é dinheiro)
 * - Resumo por anestesista
 *
 * LGPD: contém nome COMPLETO de paciente (dado de saúde sensível, art. 5º II;
 * base art. 11 II "d"). O PDF sai do perímetro RLS ao ser compartilhado —
 * por isso leva tarja CONFIDENCIAL + accountability (gerado por/quando).
 *
 * Data source: CirurgiasParticularesPage (registros já filtrados na tela)
 */

import { ANEST_COLORS, PAGE, addSectionTitle, drawTable, drawStatBox, checkPageBreak } from '../pdfBranding'

// Exibe YYYY-MM-DD como DD/MM/YYYY sem passar por Date (fuso).
const fmtDataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')

// Moeda própria: Intl injeta NBSP entre "R$" e o número, que o sanitize do
// pdfBranding não remove e a helvetica do jsPDF renderiza torto.
function moedaPdf(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  const [int, dec] = n.toFixed(2).split('.')
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

const STATUS_LABELS = {
  pendente: 'Pendente',
  pago: 'Pago',
  glosado: 'Glosado',
}

/**
 * Template metadata — subtitle carrega o período do filtro.
 */
export function getMeta(data = {}) {
  const { periodo = {}, statusFiltro } = data
  const de = periodo.inicio ? fmtDataBR(periodo.inicio) : 'início'
  const ate = periodo.fim ? fmtDataBR(periodo.fim) : 'hoje'
  const status = statusFiltro ? ` · Status: ${statusFiltro}` : ''
  return {
    title: 'Cirurgias Particulares',
    subtitle: `Cobranças de ${de} a ${ate}${status}`,
  }
}

/**
 * Render do relatório.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - { registros, periodo, statusFiltro, totais, resumoAnestesistas, geradoPor }
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { logoBase64, title } = context
  const {
    registros = [],
    totais = { total: { count: 0, valor: 0 }, porStatus: {} },
    resumoAnestesistas = [],
    geradoPor = '',
  } = data

  let y = startY

  // ========================================================================
  // TARJA CONFIDENCIAL + ACCOUNTABILITY (LGPD)
  // ========================================================================

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ANEST_COLORS.danger)
  doc.text('CONFIDENCIAL - USO INTERNO - contem dados pessoais de pacientes (LGPD)', PAGE.marginLeft, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...ANEST_COLORS.gray)
  const agora = new Date()
  const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
  doc.text(`Gerado por ${geradoPor || '-'} em ${quando}`, PAGE.width - PAGE.marginRight, y, { align: 'right' })
  y += 6

  // ========================================================================
  // RESUMO DO PERÍODO
  // ========================================================================

  y = addSectionTitle(doc, y, 'Resumo do Período')

  const boxW = 42
  const gap = 4
  const bx = PAGE.marginLeft
  const ps = totais.porStatus || {}

  drawStatBox(doc, bx, y, boxW, moedaPdf(totais.total.valor), `Total (${totais.total.count})`, ANEST_COLORS.primaryDark)
  drawStatBox(doc, bx + boxW + gap, y, boxW, moedaPdf(ps.pago?.valor || 0), `Pagas (${ps.pago?.count || 0})`, ANEST_COLORS.success)
  drawStatBox(doc, bx + (boxW + gap) * 2, y, boxW, moedaPdf(ps.pendente?.valor || 0), `Pendentes (${ps.pendente?.count || 0})`, ANEST_COLORS.warning)
  drawStatBox(doc, bx + (boxW + gap) * 3, y, boxW, moedaPdf(ps.glosado?.valor || 0), `Glosadas (${ps.glosado?.count || 0})`, ANEST_COLORS.danger)

  y += 24

  // ========================================================================
  // TABELA DE CIRURGIAS (completa; drawTable pagina sozinho)
  // ========================================================================

  y = checkPageBreak(doc, y, 20, logoBase64, title)
  y = addSectionTitle(doc, y, `Cirurgias (${registros.length})`)

  // CPF entre Paciente e Cirurgião (conferência contra recibo/guia)
  const fmtCpf = (cpf) => {
    const d = String(cpf || '').replace(/\D/g, '')
    return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : '-'
  }

  const cols = [
    { label: 'Data', width: 14, align: 'left' },
    { label: 'Paciente', width: 29, align: 'left' },
    { label: 'CPF', width: 19, align: 'left' },
    { label: 'Cirurgião', width: 20, align: 'left' },
    { label: 'Anestesista', width: 20, align: 'left' },
    { label: 'Procedimento', width: 26, align: 'left' },
    { label: 'Local', width: 14, align: 'left' },
    { label: 'Valor', width: 17, align: 'right' },
    { label: 'Status', width: 16, align: 'center' },
  ]

  const rows = registros.map((r) => [
    fmtDataBR(r.dataCirurgia),
    r.paciente || '-',
    fmtCpf(r.pacienteCpf),
    r.cirurgiao || '-',
    r.anestesistaNome || '-',
    r.procedimento || '-',
    r.local || '-',
    moedaPdf(r.valor),
    STATUS_LABELS[r.statusPagamento] || r.statusPagamento || '-',
  ])

  // Linha final de totais (destacada via rowStyle)
  rows.push(['', '', '', '', '', '', 'TOTAL', moedaPdf(totais.total.valor), String(totais.total.count)])
  const totalRowIndex = rows.length - 1

  y = drawTable(doc, y, cols, rows, {
    rowHeight: 5.5,
    fontSize: 6,
    rowStyle: (rowIndex) =>
      rowIndex === totalRowIndex
        ? { fillColor: ANEST_COLORS.tableHeader, textColor: ANEST_COLORS.primary }
        : null,
  })

  // ========================================================================
  // RESUMO POR ANESTESISTA (sem nome de paciente)
  // ========================================================================

  if (resumoAnestesistas.length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, 'Resumo por Anestesista')

    const anestCols = [
      { label: 'Anestesista', width: 60, align: 'left' },
      { label: 'Qtd', width: 15, align: 'center' },
      { label: 'Total', width: 30, align: 'right' },
      { label: 'Pago', width: 25, align: 'right' },
      { label: 'Pendente', width: 25, align: 'right' },
      { label: 'Glosado', width: 25, align: 'right' },
    ]

    const anestRows = resumoAnestesistas.map((a) => [
      a.anestesista,
      String(a.count),
      moedaPdf(a.valorTotal),
      moedaPdf(a.valorPago),
      moedaPdf(a.valorPendente),
      moedaPdf(a.valorGlosado),
    ])

    y = drawTable(doc, y, anestCols, anestRows, { rowHeight: 6, fontSize: 7 })
  }
}

export default { getMeta, render }
