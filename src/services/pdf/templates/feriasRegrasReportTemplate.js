/**
 * feriasRegrasReportTemplate.js — Regras de Férias do grupo em PDF.
 *
 * Documento de bolso: só o que trata de FÉRIAS no REGRAS DE ESCALAÇÃO
 * (cotas, vagas, distribuição, períodos nobres, feriados, prazos,
 * licenças que mexem na cota e penalidades) + FAQ. Serve para consultar
 * fora do app e para circular no grupo.
 *
 * Fonte: src/data/feriasRegrasTexto.js — mesmo conteúdo do sheet, para
 * não existirem duas versões da regra.
 */

import { ANEST_COLORS, PAGE, addSectionTitle, checkPageBreak } from '../pdfBranding'
import { REGRAS_FERIAS, FAQ_FERIAS } from '@/data/feriasRegrasTexto'

export function getMeta(data = {}) {
  return {
    title: 'Regras de Ferias',
    subtitle: `Grupo de Anestesiologia${data.ano ? ` - ${data.ano}` : ''}`,
  }
}

// -3mm de folga: sem isso a última palavra encosta na margem direita
const LARGURA = PAGE.width - PAGE.marginLeft - PAGE.marginRight - 3

/** Escreve um parágrafo com quebra automática e devolve o novo y. */
function paragrafo(doc, y, texto, { indent = 0, fontSize = 11, cor = ANEST_COLORS.black, bullet = null, logoBase64, title } = {}) {
  doc.setFontSize(fontSize)
  doc.setTextColor(...cor)
  const x = PAGE.marginLeft + indent
  const linhas = doc.splitTextToSize(texto, LARGURA - indent)
  for (let i = 0; i < linhas.length; i++) {
    y = checkPageBreak(doc, y, 8, logoBase64, title)
    if (i === 0 && bullet) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...ANEST_COLORS.primaryDark)
      doc.text(bullet, PAGE.marginLeft + indent - 4.5, y)
      doc.setTextColor(...cor)
      doc.setFont('helvetica', 'normal')
    }
    doc.text(linhas[i], x, y)
    y += fontSize * 0.62   // entrelinha folgada p/ leitura em tela pequena
  }
  return y + 3
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - { ano, geradoPor }
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { logoBase64, title } = context
  const { geradoPor = '' } = data
  let y = startY

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...ANEST_COLORS.gray)
  const agora = new Date()
  const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`
  y = paragrafo(doc, y, `Resumo das regras de ferias do documento REGRAS DE ESCALACAO do grupo. Gerado por ${geradoPor || '-'} em ${quando}.`, { fontSize: 9, cor: ANEST_COLORS.gray })
  y += 4

  for (const tema of REGRAS_FERIAS) {
    y = checkPageBreak(doc, y, 24, logoBase64, title)
    y = addSectionTitle(doc, y, tema.titulo)
    for (const item of tema.itens) {
      const marca = item.verificada ? '(app) ' : ''
      y = paragrafo(doc, y, `${marca}${item.texto}`, {
        indent: 5, bullet: '\u2022', logoBase64, title,
      })
    }
    y += 4
  }

  y = checkPageBreak(doc, y, 24, logoBase64, title)
  y = addSectionTitle(doc, y, 'Perguntas frequentes')
  for (const item of FAQ_FERIAS) {
    y = checkPageBreak(doc, y, 16, logoBase64, title)
    doc.setFont('helvetica', 'bold')
    y = paragrafo(doc, y, item.p, { fontSize: 11, cor: ANEST_COLORS.primaryDark, logoBase64, title })
    doc.setFont('helvetica', 'normal')
    y = paragrafo(doc, y, item.r, { indent: 4, fontSize: 10, cor: ANEST_COLORS.gray, logoBase64, title })
    y += 2
  }

  y = checkPageBreak(doc, y, 14, logoBase64, title)
  y += 3
  y = paragrafo(doc, y, '(app) regra conferida automaticamente pelo Extrato de Ferias.', { fontSize: 9, cor: ANEST_COLORS.gray })
  y = paragrafo(doc, y, 'Em caso de divergencia, vale o documento oficial do grupo.', { fontSize: 9, cor: ANEST_COLORS.gray })
}

export default { getMeta, render }
