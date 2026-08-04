/**
 * Notificação agregada de violações de regra de férias — helpers PUROS.
 *
 * O motor de regras roda no client de quem abre o extrato; estas funções
 * decidem QUEM recebe (coordenadores; fallback admins) e O QUE é novo
 * (diff contra ferias_violacoes_vistas). A notificação é UMA por dia,
 * agregada e SÓ COM CONTAGENS (postura do projeto desde 30/07: nada de
 * aviso por evento, nada de nome em notificação).
 */

import { REGRA_LABEL } from '@/lib/extratoFeriasRegras'

/**
 * Coordenadores de escala (mesmo critério de getResponsaveisIncidentes,
 * menos os admins) com fallback para admins se não houver coordenador
 * ativo — alguém precisa receber o alerta.
 * @returns {string[]} Firebase UIDs
 */
export function getCoordenadoresFerias(users) {
  if (!Array.isArray(users)) return []
  const ativos = users.filter((u) => u?.id && u.active !== false)
  const coordenadores = ativos.filter(
    (u) => u.isCoordenador === true || u.role === 'coordenador'
  )
  const alvo = coordenadores.length > 0 ? coordenadores : ativos.filter((u) => u.isAdmin === true)
  return alvo.map((u) => u.id)
}

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
 * nunca nomes ("3 alertas novos: 1 cota estourada, 2 dias com 7+ pessoas").
 * relatedEntityId com a data trava em 1 notificação agregada/dia via índice
 * único uniq_notifications_entity_recipient.
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
