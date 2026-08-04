/**
 * extratoFeriasReportTemplate.js - Extrato anual de Férias do grupo
 *
 * - Stat boxes (dias marcados, sócios com férias, alertas, dias no teto)
 * - Tabela coletiva (sócio, entrada, cota, dias, saldo, semanas inteiras)
 * - Alertas de regra (REGRAS ESCALAS.pdf)
 * - Seção individual opcional (quando exportado da aba Individual)
 *
 * Dado operacional interno do grupo (sem paciente) — ainda assim uso
 * interno: leva "gerado por/quando" para accountability.
 *
 * Data source: ExtratoFeriasPage — { extrato, violacoes, pessoa?, geradoPor }
 */

import { ANEST_COLORS, PAGE, addSectionTitle, drawTable, drawStatBox, checkPageBreak } from '../pdfBranding'
import { REGRA_LABEL, MAX_VAGAS_DIA } from '@/lib/extratoFeriasRegras'

const fmtBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '-')

export function getMeta(data = {}) {
  const ano = data.extrato?.ano || new Date().getFullYear()
  return {
    title: 'Extrato de Ferias',
    subtitle: `Periodo 01/01 a 31/12/${ano} - Pega Plantao`,
  }
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - { extrato, violacoes, pessoa?, geradoPor }
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { logoBase64, title } = context
  const { extrato, violacoes = [], pessoa = null, geradoPor = '' } = data
  if (!extrato) return

  let y = startY

  // Accountability
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ANEST_COLORS.gray)
  doc.text('USO INTERNO - escala de ferias do grupo', PAGE.marginLeft, y)
  doc.setFont('helvetica', 'normal')
  const agora = new Date()
  const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
  doc.text(`Gerado por ${geradoPor || '-'} em ${quando}`, PAGE.width - PAGE.marginRight, y, { align: 'right' })
  y += 6

  // ========================================================================
  // RESUMO
  // ========================================================================

  y = addSectionTitle(doc, y, 'Resumo do Ano')

  const criticas = violacoes.filter((v) => v.severidade === 'critical').length
  const diasNoTeto = [...extrato.porDia.values()].filter((n) => n.length >= MAX_VAGAS_DIA).length
  const boxW = 42
  const gap = 4
  const bx = PAGE.marginLeft

  drawStatBox(doc, bx, y, boxW, String(extrato.totalDiasContados), 'Dias marcados', ANEST_COLORS.primaryDark)
  drawStatBox(doc, bx + boxW + gap, y, boxW, `${extrato.totalPessoasComFerias}/${extrato.porPessoa.length}`, 'Socios c/ ferias', ANEST_COLORS.primary)
  drawStatBox(doc, bx + (boxW + gap) * 2, y, boxW, String(violacoes.length), `Alertas (${criticas} criticos)`, criticas ? ANEST_COLORS.danger : ANEST_COLORS.warning)
  drawStatBox(doc, bx + (boxW + gap) * 3, y, boxW, String(diasNoTeto), `Dias c/ ${MAX_VAGAS_DIA}+ pessoas`, ANEST_COLORS.warning)

  y += 24

  // ========================================================================
  // TABELA COLETIVA
  // ========================================================================

  y = checkPageBreak(doc, y, 20, logoBase64, title)
  y = addSectionTitle(doc, y, `Dias por socio (${extrato.porPessoa.length})`)

  const cols = [
    { label: 'Socio', width: 55, align: 'left' },
    { label: 'Entrada', width: 16, align: 'center' },
    { label: 'Cota', width: 14, align: 'center' },
    { label: 'Dias', width: 14, align: 'center' },
    { label: 'Saldo', width: 15, align: 'center' },
    { label: 'Sem. inteiras', width: 22, align: 'center' },
    { label: 'Situacao', width: 24, align: 'center' },
  ]

  const ordenados = [...extrato.porPessoa].sort(
    (a, b) => b.diasContados - a.diasContados || (a.nomeCompleto || a.nome).localeCompare(b.nomeCompleto || b.nome)
  )
  const rows = ordenados.map((p) => [
    p.nomeCompleto || p.nome,
    String(p.anoEntrada),
    String(p.cota),
    String(p.diasContados),
    String(p.saldo),
    String(p.semanas.filter((s) => s.inteira).length),
    p.saldo < 0 ? 'EXCEDIDA' : p.saldo === 0 ? 'Completa' : 'OK',
  ])

  y = drawTable(doc, y, cols, rows, {
    rowHeight: 5.5,
    fontSize: 6.5,
    rowStyle: (rowIndex) =>
      ordenados[rowIndex]?.saldo < 0
        ? { textColor: ANEST_COLORS.danger }
        : null,
  })

  // ========================================================================
  // ALERTAS DE REGRA
  // ========================================================================

  if (violacoes.length > 0) {
    y += 4
    y = checkPageBreak(doc, y, 30, logoBase64, title)
    y = addSectionTitle(doc, y, `Alertas de regra (${violacoes.length})`)

    const alertCols = [
      { label: 'Nivel', width: 16, align: 'center' },
      { label: 'Regra', width: 42, align: 'left' },
      { label: 'Detalhe', width: 102, align: 'left' },
    ]
    const alertRows = violacoes.map((v) => [
      v.severidade === 'critical' ? 'CRITICO' : 'Aviso',
      REGRA_LABEL[v.regra] || v.regra,
      v.detalhe,
    ])

    y = drawTable(doc, y, alertCols, alertRows, {
      rowHeight: 5.5,
      fontSize: 6,
      rowStyle: (rowIndex) =>
        violacoes[rowIndex]?.severidade === 'critical'
          ? { textColor: ANEST_COLORS.danger }
          : null,
    })
  }

  // ========================================================================
  // SEÇÃO INDIVIDUAL (opcional)
  // ========================================================================

  if (pessoa) {
    y += 4
    y = checkPageBreak(doc, y, 40, logoBase64, title)
    y = addSectionTitle(doc, y, `Extrato individual - ${pessoa.nomeCompleto || pessoa.nome}`)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...ANEST_COLORS.gray)
    doc.text(
      `Cota ${pessoa.cota} (${pessoa.regraCota}) - ${pessoa.diasContados} dias marcados - saldo ${pessoa.saldo}`,
      PAGE.marginLeft,
      y
    )
    y += 5

    const perCols = [
      { label: 'Periodo', width: 50, align: 'left' },
      { label: 'Dias uteis', width: 20, align: 'center' },
    ]
    const perRows = pessoa.periodos.map((per) => [
      per.inicio === per.fim ? fmtBr(per.inicio) : `${fmtBr(per.inicio)} a ${fmtBr(per.fim)}`,
      String(per.diasUteis),
    ])
    if (perRows.length > 0) {
      y = drawTable(doc, y, perCols, perRows, { rowHeight: 5.5, fontSize: 7 })
    }

    const notas = []
    if (pessoa.feriadosNaoContados.length) {
      notas.push(`Feriado em semana inteira (nao conta): ${pessoa.feriadosNaoContados.map(fmtBr).join(', ')}`)
    }
    if (pessoa.feriadosContados.length) {
      notas.push(`Feriado contado (semana parcial): ${pessoa.feriadosContados.map(fmtBr).join(', ')}`)
    }
    if (pessoa.fdsIgnorados.length) {
      notas.push(`Marcacao em fim de semana ignorada: ${pessoa.fdsIgnorados.map(fmtBr).join(', ')}`)
    }
    if (notas.length) {
      y += 2
      doc.setFontSize(6.5)
      doc.setTextColor(...ANEST_COLORS.gray)
      for (const nota of notas) {
        y = checkPageBreak(doc, y, 6, logoBase64, title)
        doc.text(nota, PAGE.marginLeft, y)
        y += 4
      }
    }
  }
}

export default { getMeta, render }
