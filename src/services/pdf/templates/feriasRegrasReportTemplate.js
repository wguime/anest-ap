/**
 * feriasRegrasReportTemplate.js — Regras de Férias do grupo em PDF.
 *
 * Documento de bolso: só o que trata de FÉRIAS no REGRAS DE ESCALAÇÃO
 * (cotas, vagas, distribuição, períodos nobres, feriados, prazos,
 * licenças que mexem na cota e penalidades) + FAQ. Serve para consultar
 * fora do app e para circular no grupo.
 *
 * TIPOGRAFIA PARA CELULAR (dono 04/08): corpo em 22pt — o dobro do que
 * era. Como a página segue A4 (o branding é compartilhado com todos os
 * PDFs do app), a fonte grande só cabe com margens estreitas: 8mm em vez
 * de 15mm, títulos próprios e recuo curto de bullet. Rende mais páginas,
 * e é essa a troca — o documento é lido no telefone, não impresso.
 *
 * Fonte do texto: src/data/feriasRegrasTexto.js — mesmo conteúdo do
 * sheet, para não existirem duas versões da regra.
 */

import { ANEST_COLORS, PAGE, checkPageBreak, sanitizeForPdf } from '../pdfBranding'
import { REGRAS_FERIAS, FAQ_FERIAS } from '@/data/feriasRegrasTexto'

export function getMeta(data = {}) {
  return {
    title: 'Regras de Férias',
    subtitle: `Grupo de Anestesiologia${data.ano ? ` · ${data.ano}` : ''}`,
  }
}

// Margem própria (a do branding é 15mm): com corpo 22pt, cada milímetro
// de largura vira palavra na linha
const MARGEM = 8
const LARGURA = PAGE.width - MARGEM * 2

const CORPO = 22
const TITULO = 26
const NOTA = 16

/** Altura de linha: 0.52 × corpo dá respiro sem esticar demais a página. */
const linha = (fontSize) => fontSize * 0.52

/** Parágrafo com quebra automática; devolve o novo y. */
function paragrafo(doc, y, texto, { indent = 0, fontSize = CORPO, cor = ANEST_COLORS.black, bullet = null, estilo = 'normal', logoBase64, title } = {}) {
  doc.setFontSize(fontSize)
  doc.setTextColor(...cor)
  doc.setFont('helvetica', estilo)
  const x = MARGEM + indent
  const linhas = doc.splitTextToSize(sanitizeForPdf(texto), LARGURA - indent)
  for (let i = 0; i < linhas.length; i++) {
    const antes = y
    y = checkPageBreak(doc, y, linha(fontSize) + 4, logoBase64, title)
    // addHeader (dentro do checkPageBreak) troca fonte e cor para desenhar
    // o cabeçalho e não restaura — sem isto o resto do parágrafo continua
    // na página seguinte com a tipografia do header
    if (y !== antes) {
      doc.setFontSize(fontSize)
      doc.setTextColor(...cor)
      doc.setFont('helvetica', estilo)
    }
    if (i === 0 && bullet) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...ANEST_COLORS.primaryDark)
      doc.text(bullet, MARGEM, y)
      doc.setTextColor(...cor)
      doc.setFont('helvetica', estilo)
    }
    doc.text(linhas[i], x, y)
    y += linha(fontSize)
  }
  return y + linha(fontSize) * 0.45
}

/** Cabeçalho de tema: faixa verde larga, na escala da fonte nova. */
function tituloSecao(doc, y, texto, { logoBase64, title } = {}) {
  y = checkPageBreak(doc, y, 26, logoBase64, title)
  y += 4
  const altura = 11
  doc.setFillColor(...ANEST_COLORS.tableHeader)
  doc.rect(MARGEM, y - altura + 3.5, LARGURA, altura, 'F')
  doc.setFillColor(...ANEST_COLORS.primaryDark)
  doc.rect(MARGEM, y - altura + 3.5, 2, altura, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TITULO)
  doc.setTextColor(...ANEST_COLORS.primary)
  doc.text(sanitizeForPdf(texto), MARGEM + 5, y)
  doc.setFont('helvetica', 'normal')
  return y + 14 // respiro: com corpo 22pt o 1º item colava na faixa
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

  const agora = new Date()
  const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`
  y = paragrafo(doc, y, `Resumo das regras de férias do grupo. Gerado por ${geradoPor || '-'} em ${quando}.`, {
    fontSize: NOTA, cor: ANEST_COLORS.gray, logoBase64, title,
  })
  y += 3

  for (const tema of REGRAS_FERIAS) {
    y = tituloSecao(doc, y, tema.titulo, { logoBase64, title })
    for (const item of tema.itens) {
      const marca = item.verificada ? '(app) ' : ''
      y = paragrafo(doc, y, `${marca}${item.texto}`, {
        indent: 6, bullet: '•', logoBase64, title,
      })
    }
  }

  y = tituloSecao(doc, y, 'Perguntas frequentes', { logoBase64, title })
  for (const item of FAQ_FERIAS) {
    y = paragrafo(doc, y, item.p, { estilo: 'bold', cor: ANEST_COLORS.primaryDark, logoBase64, title })
    y = paragrafo(doc, y, item.r, { indent: 4, cor: ANEST_COLORS.gray, logoBase64, title })
    y += 3
  }

  y += 4
  y = paragrafo(doc, y, '(app) regra conferida automaticamente pelo Extrato de Férias.', {
    fontSize: NOTA, cor: ANEST_COLORS.gray, logoBase64, title,
  })
  y = paragrafo(doc, y, 'Em caso de divergência, vale o documento oficial do grupo.', {
    fontSize: NOTA, cor: ANEST_COLORS.gray, logoBase64, title,
  })
}

export default { getMeta, render }
