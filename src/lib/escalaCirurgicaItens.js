/**
 * Classificação semântica dos itens importados da escala cirúrgica.
 *
 * Compatibilidade: posições assistenciais ainda são persistidas na tabela de casos
 * para não exigir uma migration emergencial, mas todo o front pode distingui-las e
 * impedir que sejam apresentadas/contadas como cirurgia. O modelo definitivo deve
 * movê-las para `posicoes_assistenciais` no cabeçalho da escala.
 */

const texto = (v) => String(v || '').trim()
// `\p{M}` (marcas combinantes) em vez do range literal: a mesma limpeza de
// acentos das outras chaves do arquivo, sem depender de caracteres invisíveis
// no fonte.
const semAcento = (v) => texto(v).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

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

const ehSrpa = (item) => {
  const sala = semAcento(item?.sala)
  return texto(item?.bloco).toLowerCase() === 'srpa' || /\bSRPA\b/.test(sala)
}

/**
 * Hora em que a posição assistencial COMEÇA quando o mapa não traz nenhuma.
 *
 * A SRPA da Unimed entra às 09:00 (dono 18/08). O mapa nunca escreve esse
 * horário — nas 37 publicações com SRPA, 34 vieram sem hora — e sem ele a
 * posição fica fora de toda conta de tempo: não tem início para o cronômetro,
 * não decide turno sozinha e aparece no quadro como uma linha muda.
 *
 * Só o MATUTINO recebe o carimbo. A hora é o que decide o turno na publicação
 * (`selecionarCasosDoTurno`), então 09:00 numa publicação vespertina jogaria a
 * SRPA para FORA do turno — a posição sumiria da escala da tarde. O horário de
 * entrada da SRPA vespertina ninguém informou; até lá ela segue sem hora, como
 * sempre esteve, herdando o turno selecionado.
 */
export const HORA_PADRAO_SRPA = { unimed: { matutino: '09:00' } }

export function aplicarHoraPadraoPosicoes(itens, hospital, turno) {
  const hora = HORA_PADRAO_SRPA[hospital]?.[turno]
  if (!hora) return itens || []
  return (itens || []).map((item) => (
    ehPosicaoAssistencial(item) && ehSrpa(item) && !texto(item?.hora)
      ? { ...item, hora }
      : item
  ))
}

/** A posição é a SRPA (não outra posição assistencial, como o Consultório do HRO). */
export function ehPosicaoSrpa(item) {
  return ehPosicaoAssistencial(item) && ehSrpa(item)
}

/**
 * Horário em que quem está na SRPA a assume, pelo turno EXIBIDO (dono 26/10: "sempre
 * assume ela às 09:00h até as 13:00h, mesmo acontece à tarde (13:00 às 19:00h) e à
 * noite (19:00h às 22:00h)"). É o que o quadro mostra — a publicação segue carimbando
 * só o 09:00 da manhã (`HORA_PADRAO_SRPA`): a hora decide o turno ao publicar.
 * A noite lê os casos da tarde, então ali vale 19:00 mesmo com hora gravada.
 */
export const HORA_INICIO_SRPA = { matutino: '09:00', vespertino: '13:00', noturno: '19:00' }

export function horaInicioSrpa(item, turnoExibido) {
  if (turnoExibido === 'noturno') return HORA_INICIO_SRPA.noturno
  return texto(item?.hora) || HORA_INICIO_SRPA[turnoExibido] || ''
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
