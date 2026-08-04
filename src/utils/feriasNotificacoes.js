/**
 * Notificação agregada de violações de regra de férias — helpers PUROS.
 *
 * O motor de regras roda no client de quem abre o extrato; estas funções
 * decidem QUEM recebe e O QUE é novo (diff contra ferias_violacoes_vistas).
 * A notificação é UMA por dia, agregada e SÓ COM CONTAGENS (postura do
 * projeto desde 30/07: nada de aviso por evento, nada de nome em
 * notificação).
 */

import { REGRA_LABEL } from '@/lib/extratoFeriasRegras'
import { EMAILS_EXTRATO_FERIAS, EMAILS_COMITE_ETICA } from '@/pages/ferias/gate'

/**
 * Destinatários = exatamente quem tem acesso ao extrato (allowlist do gate:
 * Guilherme [2 contas], Fernanda e Leandro — dono 03/08). Notificar fora da
 * lista mandaria alguém para uma rota que o gate devolve à Home.
 * @returns {string[]} Firebase UIDs
 */
export function getDestinatariosFerias(users) {
  if (!Array.isArray(users)) return []
  return users
    .filter(
      (u) =>
        u?.id &&
        u.active !== false &&
        EMAILS_EXTRATO_FERIAS.includes((u.email || '').trim().toLowerCase())
    )
    .map((u) => u.id)
}

/**
 * Membros do Comitê de Ética (ativos) — recebem o aviso de marcação além
 * da cota. Lista em gate.js, decisão do dono 04/08.
 * @returns {string[]} Firebase UIDs
 */
export function getComiteEtica(users) {
  if (!Array.isArray(users)) return []
  return users
    .filter(
      (u) =>
        u?.id &&
        u.active !== false &&
        EMAILS_COMITE_ETICA.includes((u.email || '').trim().toLowerCase())
    )
    .map((u) => u.id)
}

/**
 * Aviso ao Comitê de Ética: alguém marcou férias além da cota.
 *
 * Aqui o nome VAI na notificação (ao contrário do alerta agregado de
 * regras): o propósito é justamente atribuir a marcação irregular a quem
 * a fez, para o Comitê decidir a perda de dias (REGRAS, Penalidades).
 * relatedEntityId por pessoa+dia trava repetição do mesmo caso no dia.
 */
export function buildExcedenteNotificationPayload({
  nomeCompleto, diasExcedidos, cota, diasMarcados, ano, hojeISO, recipientIds = [],
}) {
  return {
    category: 'sistema',
    subject: `Férias acima da cota: ${nomeCompleto}`,
    content: `${nomeCompleto} marcou ${diasMarcados} dias de férias em ${ano} para uma cota de ${cota} — ${diasExcedidos} dia${diasExcedidos !== 1 ? 's' : ''} além do direito. Conferir no Extrato de Férias.`,
    senderName: 'Extrato de Férias',
    priority: 'alta',
    actionUrl: 'extratoFerias',
    actionLabel: 'Ver extrato',
    relatedEntityType: 'ferias_excedente',
    relatedEntityId: `ferias-excedente-${ano}-${slugNome(nomeCompleto)}-${(hojeISO || '').replaceAll('-', '')}`,
    dismissable: true,
    recipientIds: recipientIds.filter(Boolean),
  }
}

const slugNome = (nome = '') =>
  nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ´`']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Violações ainda não registradas em ferias_violacoes_vistas.
 * @param {Array<{id: string}>} violacoes saída de avaliarRegras
 * @param {Array<{violacao_id: string}>|Set<string>} vistas linhas do banco (ou Set de ids)
 */
export function diffViolacoesNovas(violacoes = [], vistas = []) {
  const vistasSet = vistas instanceof Set
    ? vistas
    : new Set([...vistas].map((v) => (typeof v === 'string' ? v : v?.violacao_id)).filter(Boolean))
  return violacoes.filter((v) => v?.id && !vistasSet.has(v.id))
}

/**
 * Payload agregado p/ createSystemNotification — SÓ CONTAGENS por regra,
 * nunca nomes ("3 alertas novos: 1 acima da cota anual, 2 mais de 6 no
 * mesmo dia"). relatedEntityId com a data trava em 1 notificação
 * agregada/dia via índice único uniq_notifications_entity_recipient.
 */
export function buildFeriasNotificationPayload({ novas = [], ano, hojeISO, recipientIds = [] }) {
  const porRegra = new Map()
  for (const v of novas) {
    porRegra.set(v.regra, (porRegra.get(v.regra) || 0) + 1)
  }
  const resumo = [...porRegra.entries()]
    .map(([regra, n]) => `${n}× ${(REGRA_LABEL[regra] || regra).toLowerCase()}`)
    .join(' · ')
  const criticas = novas.filter((v) => v.severidade === 'critical').length

  return {
    category: 'sistema',
    subject: `Férias ${ano}: ${novas.length} alerta${novas.length !== 1 ? 's' : ''} de regra novo${novas.length !== 1 ? 's' : ''}`,
    content: `${resumo}${criticas ? ` (${criticas} crítico${criticas !== 1 ? 's' : ''})` : ''}. Detalhes no extrato.`,
    senderName: 'Extrato de Férias',
    priority: criticas > 0 ? 'alta' : 'normal',
    actionUrl: 'extratoFerias',
    actionLabel: 'Ver extrato',
    relatedEntityType: 'ferias_regras',
    relatedEntityId: `ferias-regras-${ano}-${(hojeISO || '').replaceAll('-', '')}`,
    dismissable: true,
    recipientIds: recipientIds.filter(Boolean),
  }
}
