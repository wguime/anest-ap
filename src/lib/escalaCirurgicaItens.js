/**
 * Classificação semântica dos itens importados da escala cirúrgica.
 *
 * Compatibilidade: posições assistenciais ainda são persistidas na tabela de casos
 * para não exigir uma migration emergencial, mas todo o front pode distingui-las e
 * impedir que sejam apresentadas/contadas como cirurgia. O modelo definitivo deve
 * movê-las para `posicoes_assistenciais` no cabeçalho da escala.
 */

const texto = (v) => String(v || '').trim()

const CAMPOS_CLINICOS = [
  'pacienteIniciais', 'pacienteNome', 'procedimento', 'cirurgiao', 'convenio',
]

export function temConteudoClinico(item) {
  return CAMPOS_CLINICOS.some((campo) => texto(item?.[campo])) || item?.isContinuacao === true
}

/** SRPA é uma posição de trabalho, não uma cirurgia. */
export function ehPosicaoAssistencial(item) {
  if (item?.posicaoAssistencial === true) return true
  const sala = texto(item?.sala).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const bloco = texto(item?.bloco).toLowerCase()
  return !temConteudoClinico(item) && (bloco === 'srpa' || /\bSRPA\b/.test(sala))
}

/** Descarta somente ruído vazio/título; preserva casos e posições assistenciais. */
export function filtrarItensImportados(itens) {
  return (itens || []).filter((item) => temConteudoClinico(item) || ehPosicaoAssistencial(item))
}

export function resumirItensEscala(itens) {
  let cirurgias = 0
  let posicoes = 0
  for (const item of itens || []) {
    if (ehPosicaoAssistencial(item)) posicoes += 1
    else cirurgias += 1
  }
  return { cirurgias, posicoes, total: cirurgias + posicoes }
}

const chaveDuplicata = (item) => [
  item?.sala, item?.hora, item?.pacienteIniciais, item?.procedimento, item?.cirurgiao,
].map((v) => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()).join('|')

/**
 * Detecta duplicatas exatas para conferência humana. Não remove automaticamente:
 * dois procedimentos semelhantes podem ser reais, e apagar um seria perda clínica.
 */
export function detectarItensDuplicados(itens) {
  const vistos = new Map()
  for (const item of itens || []) {
    if (ehPosicaoAssistencial(item)) continue
    const chave = chaveDuplicata(item)
    if (!chave.replaceAll('|', '')) continue
    const atual = vistos.get(chave) || { quantidade: 0, item }
    atual.quantidade += 1
    vistos.set(chave, atual)
  }
  return [...vistos.values()].filter((grupo) => grupo.quantidade > 1)
}
