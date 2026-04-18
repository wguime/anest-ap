/**
 * Sobreaviso Materno Notifications — funções puras que geram payload
 * por evento do ciclo de vida de uma troca de sobreaviso.
 */

const CATEGORY = 'sobreaviso';
const PRIORITY = 'alta';
const ACTION_URL = 'trocasSobreaviso';
const ACTION_LABEL = 'Ver Troca';

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const EVENTS = ['created', 'accepted', 'rejected', 'cancelled'];

export function buildSobreavisoNotificationContent(event, trade, ctx = {}) {
  if (!EVENTS.includes(event)) {
    throw new Error(`Evento inválido: ${event}`);
  }
  const actor = ctx.actorFirstName || 'Uma funcionária';
  const isSwap = !!trade?.dataDesejada;
  const codigo = trade?.codigo || '—';
  const ds = formatDateBR(trade?.dataSobreaviso);
  const dd = formatDateBR(trade?.dataDesejada);

  if (event === 'created') {
    return isSwap
      ? {
          subject: 'Nova solicitação de troca de sobreaviso',
          content: `${actor} quer trocar o sobreaviso de ${ds} pelo de ${dd}. Código: ${codigo}`,
        }
      : {
          subject: 'Nova solicitação de cobertura de sobreaviso',
          content: `${actor} pede cobertura para o sobreaviso de ${ds}. Código: ${codigo}`,
        };
  }

  if (event === 'accepted') {
    return {
      subject: 'Sua troca de sobreaviso foi aceita',
      content: isSwap
        ? `${actor} aceitou trocar ${ds} por ${dd}. Código: ${codigo}`
        : `${actor} aceitou cobrir o sobreaviso de ${ds}. Código: ${codigo}`,
    };
  }

  if (event === 'rejected') {
    return {
      subject: 'Sua troca de sobreaviso foi rejeitada',
      content: `${actor} rejeitou sua solicitação (${codigo}). Você pode criar outra.`,
    };
  }

  return {
    subject: 'Troca de sobreaviso cancelada',
    content: `${actor} cancelou a solicitação de troca (${codigo}).`,
  };
}

export function getSobreavisoNotificationRecipients(event, trade, ctx = {}) {
  const { actorFuncionariaId, allFuncionariaIds = [] } = ctx;

  if (event === 'created') {
    if (trade?.destinatarioId) return [trade.destinatarioId];
    return allFuncionariaIds.filter((id) => id && id !== actorFuncionariaId);
  }

  if (event === 'accepted' || event === 'rejected') {
    return trade?.solicitanteFuncionariaId ? [trade.solicitanteFuncionariaId] : [];
  }

  if (event === 'cancelled') {
    return trade?.destinatarioId ? [trade.destinatarioId] : [];
  }

  return [];
}

export function buildSobreavisoNotificationPayload(event, trade, ctx, recipientUids) {
  const { subject, content } = buildSobreavisoNotificationContent(event, trade, ctx);
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
