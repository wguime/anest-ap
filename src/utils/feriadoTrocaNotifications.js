/**
 * Notificações da troca de FERIADO — funções puras (nenhuma faz I/O).
 *
 * O dono decidiu em 03/09: notifica, e só quem precisa agir. Quem pede não recebe nada do
 * próprio pedido; a contraparte é avisada do pedido e do cancelamento; e quem pediu é avisado
 * do aceite ou da recusa. Nada de avisar o grupo — a troca de feriado é entre duas pessoas.
 *
 * ⚠️ Só entram no texto os campos listados aqui. O documento da troca guarda uid e número da
 * legenda, e nada disso pertence a uma notificação que vive no banco (mesma trava que o
 * módulo de plantão hospitalar tem em teste).
 */

const CATEGORY = 'plantao'
const PRIORITY = 'alta'
const ACTION_URL = 'feriados'
const ACTION_LABEL = 'Ver troca'

const EVENTS = ['created', 'accepted', 'rejected', 'cancelled']

const brData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

/** "o feriado de INDEPENDENCIA (07/09/2026)" ou, sem nome no dataset, só a data. */
function descreverFeriado(nome, data) {
  const d = brData(data)
  return nome ? `o feriado de ${nome} (${d})` : `o feriado de ${d}`
}

function descreverPedido(trade) {
  if (trade?.escopo === 'posicao') {
    return `trocar de posição na fila d${descreverFeriado(trade.feriadoNome, trade.feriadoData).slice(1)}`
  }
  return `trocar ${descreverFeriado(trade?.feriadoNome, trade?.feriadoData)} pel${descreverFeriado(trade?.feriadoDesejadoNome, trade?.feriadoDesejado).slice(1)}`
}

export function buildFeriadoTrocaNotificationContent(event, trade, ctx = {}) {
  if (!EVENTS.includes(event)) throw new Error(`Evento inválido: ${event}`)
  const codigo = trade?.codigo || ''
  const quemPediu = trade?.solicitanteNome || 'Um colega'
  const quemRespondeu = ctx.actorNome || trade?.respondidoPorNome || 'O colega'
  const motivo = trade?.descricao ? ` Motivo: ${trade.descricao}` : ''

  if (event === 'created') {
    return {
      subject: 'Pedido de troca de feriado',
      content: `${quemPediu} quer ${descreverPedido(trade)} com você (${codigo}).${motivo}`,
    }
  }
  if (event === 'accepted') {
    return {
      subject: 'Troca de feriado aceita',
      content: `${quemRespondeu} aceitou ${descreverPedido(trade)} (${codigo}). A fila do feriado já mostra a troca.`,
    }
  }
  if (event === 'rejected') {
    return {
      subject: 'Troca de feriado recusada',
      content: `${quemRespondeu} recusou o pedido para ${descreverPedido(trade)} (${codigo}).`,
    }
  }
  return {
    subject: 'Troca de feriado cancelada',
    content: `${quemPediu} cancelou o pedido para ${descreverPedido(trade)} (${codigo}).`,
  }
}

/** uids de quem recebe. `created`/`cancelled` → a contraparte; `accepted`/`rejected` → quem pediu. */
export function getFeriadoTrocaNotificationRecipients(event, trade) {
  if (event === 'created' || event === 'cancelled') {
    return trade?.destinatarioUid ? [trade.destinatarioUid] : []
  }
  if (event === 'accepted' || event === 'rejected') {
    return trade?.solicitanteUid ? [trade.solicitanteUid] : []
  }
  return []
}

export const FERIADO_TROCA_NOTIF_META = { CATEGORY, PRIORITY, ACTION_URL, ACTION_LABEL }
export const __internal = { EVENTS, brData, descreverPedido }
