/**
 * Trade Notifications — funções puras que geram payload de notificação
 * por evento do ciclo de vida de uma troca de plantão.
 *
 * Não dependem de Firebase/Firestore/React — devolvem estruturas simples
 * que o caller converte em `createSystemNotification(...)` com recipientIds
 * já resolvidos (residenteId → Firebase UID).
 */

const CATEGORY = 'plantao';
const PRIORITY = 'alta';
const ACTION_URL = 'trocasPlantao';
const ACTION_LABEL = 'Ver Troca';

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const EVENTS = ['created', 'accepted', 'rejected', 'cancelled'];

/**
 * Gera { subject, content } conforme o evento + shape do trade.
 * @param {'created'|'accepted'|'rejected'|'cancelled'} event
 * @param {Object} trade — { codigo, dataPlantao, dataDesejada, solicitanteNome, destinatarioNome, ... }
 * @param {Object} ctx — { actorFirstName } — quem executa a ação
 * @returns {{subject: string, content: string}}
 */
export function buildTradeNotificationContent(event, trade, ctx = {}) {
  if (!EVENTS.includes(event)) {
    throw new Error(`Evento inválido: ${event}`);
  }
  const actor = ctx.actorFirstName || 'Um residente';
  const isSwap = !!trade?.dataDesejada;
  const codigo = trade?.codigo || '—';
  const dp = formatDateBR(trade?.dataPlantao);
  const dd = formatDateBR(trade?.dataDesejada);

  if (event === 'created') {
    return isSwap
      ? {
          subject: 'Nova solicitação de troca de plantão',
          content: `${actor} quer trocar o plantão de ${dp} pelo de ${dd}. Código: ${codigo}`,
        }
      : {
          subject: 'Nova solicitação de cobertura de plantão',
          content: `${actor} pede cobertura para o plantão de ${dp}. Código: ${codigo}`,
        };
  }

  if (event === 'accepted') {
    return {
      subject: 'Sua troca foi aceita',
      content: isSwap
        ? `${actor} aceitou trocar ${dp} por ${dd}. Código: ${codigo}`
        : `${actor} aceitou cobrir o plantão de ${dp}. Código: ${codigo}`,
    };
  }

  if (event === 'rejected') {
    return {
      subject: 'Sua troca foi rejeitada',
      content: `${actor} rejeitou sua solicitação de troca (${codigo}). Você pode criar outra.`,
    };
  }

  // cancelled
  return {
    subject: 'Troca de plantão cancelada',
    content: `${actor} cancelou a solicitação de troca (${codigo}).`,
  };
}

/**
 * Quem deve receber a notificação, em residenteIds (o caller resolve para Firebase UIDs).
 *
 * @param {string} event
 * @param {Object} trade
 * @param {Object} ctx — { actorResidenteId, allResidenteIds[] }
 * @returns {string[]} — array de residenteIds (ou [] se ninguém deve ser notificado)
 */
export function getTradeNotificationRecipients(event, trade, ctx = {}) {
  const { actorResidenteId, allResidenteIds = [] } = ctx;

  if (event === 'created') {
    // Direcionada → destinatário. Aberta → todos os outros residentes.
    if (trade?.destinatarioId) return [trade.destinatarioId];
    return allResidenteIds.filter((id) => id && id !== actorResidenteId);
  }

  if (event === 'accepted' || event === 'rejected') {
    // Solicitante é avisado. Retornamos o residenteId dele como chave — caller
    // pode usar o solicitanteId (Firebase UID) direto sem lookup residenteId→uid.
    return trade?.solicitanteResidenteId ? [trade.solicitanteResidenteId] : [];
  }

  if (event === 'cancelled') {
    // Só notifica destinatário quando a troca era direcionada.
    return trade?.destinatarioId ? [trade.destinatarioId] : [];
  }

  return [];
}

/**
 * Monta o objeto completo pronto para `createSystemNotification`, dado:
 *   - evento
 *   - trade
 *   - ctx com actorFirstName, actorResidenteId, allResidenteIds
 *   - recipientUids — Firebase UIDs já resolvidos (em vez de residenteIds)
 *
 * Útil nos testes: combina content + recipientIds em um payload.
 */
export function buildTradeNotificationPayload(event, trade, ctx, recipientUids) {
  const { subject, content } = buildTradeNotificationContent(event, trade, ctx);
  return {
    category: CATEGORY,
    priority: PRIORITY,
    actionUrl: ACTION_URL,
    actionLabel: ACTION_LABEL,
    subject,
    content,
    recipientIds: recipientUids || [],
  };
}

export const __internal = { formatDateBR, EVENTS };
