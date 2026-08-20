/**
 * feriasSemestreReportTemplate.js — Férias por semestre (só a análise)
 *
 * Dono 20/08: o relatório completo de férias traz stat boxes, a tabela geral
 * e os 51 alertas de regra; para discutir a divisão do ano isso é ruído. Aqui
 * entra SÓ a distribuição entre as metades do ano, agrupada pelo que precisa
 * de conversa — quem passou do máximo do 2º semestre, quem ficou abaixo do
 * mínimo do 1º, quem é do 1º ano e fracionou a semana, e quem está em dia.
 *
 * Agrupar por situação (e não em ordem alfabética, como faz o relatório
 * completo) é a diferença dos dois documentos: lá se procura uma pessoa, aqui
 * se lê o problema.
 *
 * Data source: ExtratoFeriasPage — { extrato, geradoPor }
 */

import {
  ANEST_COLORS, PAGE, addSectionTitle, drawTable, drawStatBox, checkPageBreak, sanitizeForPdf,
} from '../pdfBranding'
import { linhaAnaliseSemestre } from '@/lib/feriasSemestre'
import { getFeriados } from '@/lib/feriasFeriados'
import { hojeLocalISO } from '@/lib/feriasMarcacao'

export function getMeta(data = {}) {
  const ano = data.extrato?.ano || new Date().getFullYear()
  return {
    title: 'Férias por semestre',
    subtitle: `Distribuição entre 1º e 2º semestre de ${ano} · Pega Plantão`,
  }
}

/**
 * Cada grupo tem as colunas da SUA pergunta (dono 20/08: "quero que contenha
 * de forma clara quem retirou/marcou mais férias que o permitido no 2º
 * semestre"). Um conjunto único de colunas obrigava a ler "22 de 17" e a
 * descobrir sozinho que o excesso era 5 — o número que interessa virava conta
 * de cabeça. Aqui ele é coluna.
 *
 * As parcelas somam o total à vista (já tirou + ainda vai tirar + 7ª vaga):
 * sem a coluna da penalidade a linha de quem a tem não fecha.
 */
const COLS_ACIMA = [
  { label: 'Sócio', width: 46, align: 'left' },
  { label: 'Cota', width: 10, align: 'center' },
  { label: 'Podia no 2º sem.', width: 26, align: 'center' },
  { label: 'Já tirou', width: 20, align: 'center' },
  { label: 'Ainda vai tirar', width: 26, align: 'center' },
  { label: 'Marcou no 2º sem.', width: 28, align: 'center' },
  { label: 'DIAS A MAIS', width: 24, align: 'center' },
]

const linhaAcima = (a) => [
  a.nomeCompleto,
  String(a.cota),
  String(a.s2Maximo),
  String(a.s2Usufruido),
  String(a.s2Agendado),
  String(a.s2Usufruido + a.s2Agendado),
  `+${a.s2Usufruido + a.s2Agendado - a.s2Maximo}`,
]

/**
 * Grupo separado (revisão 20/08): estas pessoas marcaram EXATAMENTE o
 * permitido — quem estourou o semestre foi o custo da 7ª vaga, que conta 3
 * dias em vez de 1. Deixá-las na tabela de "marcaram mais do que podiam" é
 * acusação errada: elas não marcaram nada além do limite.
 */
// ⚠️ drawTable NÃO quebra cabeçalho — trunca com "...". "DIAS A MAIS" em
// 16mm virava "DIAS A MAI". Somar sempre 180 (PAGE.contentWidth).
const COLS_SETIMA = [
  { label: 'Sócio', width: 46, align: 'left' },
  { label: 'Cota', width: 10, align: 'center' },
  { label: 'Podia no 2º sem.', width: 26, align: 'center' },
  { label: 'Marcou no 2º sem.', width: 28, align: 'center' },
  { label: '7ª vaga', width: 16, align: 'center' },
  { label: 'Total consumido', width: 28, align: 'center' },
  { label: 'DIAS A MAIS', width: 26, align: 'center' },
]

const linhaSetima = (a) => [
  a.nomeCompleto,
  String(a.cota),
  String(a.s2Maximo),
  String(a.s2Usufruido + a.s2Agendado),
  `+${a.s2Penalidade}`,
  String(a.s2Total),
  `+${a.s2Excede}`,
]

const COLS_ABAIXO = [
  { label: 'Sócio', width: 46, align: 'left' },
  { label: 'Cota', width: 10, align: 'center' },
  { label: 'Devia no 1º sem.', width: 26, align: 'center' },
  { label: 'Tirou no 1º sem.', width: 26, align: 'center' },
  { label: 'DIAS EM FALTA', width: 24, align: 'center' },
  { label: 'Total no 2º sem.', width: 24, align: 'center' },
  { label: 'Podia no 2º sem.', width: 24, align: 'center' },
]

const linhaAbaixo = (a) => [
  a.nomeCompleto,
  String(a.cota),
  String(a.s1Minimo),
  String(a.s1Total),
  `-${a.s1Falta}`,
  String(a.s2Total),
  String(a.s2Maximo),
]

const COLS_PRIMEIRO_ANO = [
  { label: 'Sócio', width: 50, align: 'left' },
  { label: 'Cota', width: 12, align: 'center' },
  { label: 'Dias no 1º sem.', width: 26, align: 'center' },
  { label: 'Dias no 2º sem.', width: 26, align: 'center' },
  { label: 'Como estão marcados', width: 66, align: 'left' },
]

const linhaPrimeiroAno = (a) => [
  a.nomeCompleto,
  String(a.cota),
  String(a.s1Total),
  String(a.s2Total),
  a.primeiroAnoDetalhe,
]

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} startY
 * @param {Object} data - { extrato, geradoPor }
 * @param {Object} context - { logoBase64, title }
 */
export async function render(doc, startY, data, context = {}) {
  const { logoBase64, title } = context
  const { extrato, geradoPor = '' } = data
  if (!extrato) return

  let y = startY
  const ano = extrato.ano
  const feriados = getFeriados(ano)
  const hojeISO = hojeLocalISO()

  const analise = [...extrato.porPessoa]
    .sort((a, b) => (a.nomeCompleto || a.nome).localeCompare(b.nomeCompleto || b.nome, 'pt-BR'))
    .map((p) => linhaAnaliseSemestre(p, { ano, feriados, hojeISO }))

  const soma = (campo) => analise.reduce((acc, a) => acc + a[campo], 0)

  // Grupos mutuamente exclusivos, do mais grave ao menos. Dentro de cada um a
  // ordem é pelo TAMANHO do desvio, não alfabética: numa tabela cujo título é
  // "quem passou e por quanto", o maior caso não pode ficar escondido no meio
  // (o +10 do Matheus caía na 12ª linha).
  const marcadoS2 = (a) => a.s2Usufruido + a.s2Agendado
  const acima = analise
    .filter((a) => marcadoS2(a) > a.s2Maximo && !a.semestreLivre)
    .sort((x, z) => (marcadoS2(z) - z.s2Maximo) - (marcadoS2(x) - x.s2Maximo) || x.nomeCompleto.localeCompare(z.nomeCompleto, 'pt-BR'))
  // Marcou o permitido e mesmo assim estourou: o custo veio da 7ª vaga
  const porSetima = analise.filter(
    (a) => !a.semestreLivre && marcadoS2(a) <= a.s2Maximo && a.s2Excede > 0
  )
  const soAbaixo = analise
    .filter((a) => !a.semestreLivre && a.s2Excede === 0 && marcadoS2(a) <= a.s2Maximo && a.s1Falta > 0)
    .sort((x, z) => z.s1Falta - x.s1Falta || x.nomeCompleto.localeCompare(z.nomeCompleto, 'pt-BR'))
  const fracionada = analise.filter((a) => a.semestreLivre && a.situacao !== 'Semana corrida')
  const jaListados = new Set([...acima, ...porSetima, ...soAbaixo, ...fracionada].map((a) => a.nome))
  const emDia = analise.filter((a) => !jaListados.has(a.nome))

  // ── Números do grupo ──────────────────────────────────────────────────────
  const gap = 4
  const boxW = (PAGE.contentWidth - gap * 3) / 4
  const bx = PAGE.marginLeft
  drawStatBox(doc, bx, y, boxW, soma('s1Total'), 'Dias no 1º semestre', ANEST_COLORS.primaryDark)
  drawStatBox(doc, bx + (boxW + gap), y, boxW, soma('s2Total'), 'Dias no 2º semestre', ANEST_COLORS.primaryDark)
  drawStatBox(doc, bx + (boxW + gap) * 2, y, boxW, soma('s2Usufruido'), 'Do 2º, já tirados', ANEST_COLORS.gray)
  drawStatBox(doc, bx + (boxW + gap) * 3, y, boxW, soma('s2Agendado'), 'Do 2º, ainda agendados', ANEST_COLORS.teal)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...ANEST_COLORS.gray)
  const legenda = doc.splitTextToSize(
    sanitizeForPdf(
      'Regra do grupo: metade da cota tem de ser usufruída até 30/06 (mínimo do 1º semestre; 31/07 para quem tem filhos em idade escolar) e o 2º semestre nunca passa da outra metade (máximo). ' +
      'Cota de 5 dias (1º ano) escolhe o semestre, mas a semana tem de ser corrida, de segunda a sexta. ' +
      `Só os dias ainda agendados dão para remanejar. O 2º semestre soma ${soma('s2Usufruido')} já tirados + ${soma('s2Agendado')} ainda agendados + ${soma('s2Penalidade')} de custo da 7ª vaga.`
    ),
    PAGE.contentWidth
  )
  doc.text(legenda, PAGE.marginLeft, y)
  y += legenda.length * 3.2 + 4

  // ── Grupos ────────────────────────────────────────────────────────────────
  // Cor só onde a regra foi rompida (vermelho). O grupo de quem ficou abaixo
  // do mínimo fica em preto: o âmbar sobre branco some no papel, e o próprio
  // título da seção já diz o que aquelas linhas têm em comum.
  const secao = (titulo, lista, cols, mapper, { cor = null, nota = null } = {}) => {
    if (lista.length === 0) return
    y += 2
    y = checkPageBreak(doc, y, 32, logoBase64, title)
    y = addSectionTitle(doc, y, `${titulo} (${lista.length})`)
    if (nota) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...ANEST_COLORS.gray)
      const partes = doc.splitTextToSize(sanitizeForPdf(nota), PAGE.contentWidth)
      doc.text(partes, PAGE.marginLeft, y + 3.5)
      y += partes.length * 3.2 + 2.5
    }
    y = drawTable(doc, y, cols, lista.map(mapper), {
      rowHeight: 5.5,
      fontSize: 6.5,
      rowStyle: cor ? () => ({ textColor: cor }) : null,
    })
    y += 3
  }

  secao(
    'Marcaram mais dias do que podiam no 2º semestre',
    acima,
    COLS_ACIMA,
    linhaAcima,
    {
      cor: ANEST_COLORS.danger,
      nota: 'Podia = metade da cota. Já tirou + ainda vai tirar = marcou no 2º semestre. A última coluna é quanto isso passou do permitido. Em ordem do maior excesso para o menor.',
    }
  )
  secao(
    'Passaram do limite do 2º semestre pelo custo da 7ª vaga',
    porSetima,
    COLS_SETIMA,
    linhaSetima,
    {
      cor: ANEST_COLORS.warning,
      nota: 'Estes NÃO marcaram além do permitido — marcaram exatamente o limite. O dia usado na 7ª vaga conta 3 dias de férias em vez de 1, e é esse custo extra que fez o consumo do semestre passar da metade da cota.',
    }
  )
  secao(
    'Tiraram menos do que deviam no 1º semestre',
    soAbaixo,
    COLS_ABAIXO,
    linhaAbaixo,
    {
      nota: 'Devia = metade da cota até 30/06. Estes estão dentro do permitido no 2º semestre, então os dias em falta não cabem mais em 2026. Em ordem da maior falta para a menor.',
    }
  )
  secao(
    '1º ano — semana não corrida',
    fracionada,
    COLS_PRIMEIRO_ANO,
    linhaPrimeiroAno,
    {
      cor: ANEST_COLORS.danger,
      nota: 'No 1º ano não há mínimo nem máximo por semestre: a semana pode ficar em qualquer um dos dois, mas os 5 dias têm de ser corridos, de segunda a sexta.',
    }
  )

  if (emDia.length > 0) {
    y += 2
    y = checkPageBreak(doc, y, 24, logoBase64, title)
    y = addSectionTitle(doc, y, `Dentro da regra nos dois semestres (${emDia.length})`)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...ANEST_COLORS.black)
    const nomes = doc.splitTextToSize(
      sanitizeForPdf(emDia.map((a) => a.nomeCompleto).join(' · ')),
      PAGE.contentWidth
    )
    doc.text(nomes, PAGE.marginLeft, y + 4)
    y += nomes.length * 4 + 5
  }

  // ── Rodapé de proveniência ────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 14, logoBase64, title)
  doc.setFontSize(6.5)
  doc.setTextColor(...ANEST_COLORS.gray)
  doc.text(
    sanitizeForPdf(
      `Uso interno do grupo. Posição de ${hojeISO.slice(8, 10)}/${hojeISO.slice(5, 7)}/${hojeISO.slice(0, 4)}` +
      (geradoPor ? ` · gerado por ${geradoPor}` : '')
    ),
    PAGE.marginLeft,
    y + 3
  )
}
