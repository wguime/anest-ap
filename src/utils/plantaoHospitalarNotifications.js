/**
 * Plantão Hospitalar Notifications — funções puras que geram payload por
 * evento do ciclo de vida de uma troca de plantão hospitalar (FDS/feriado).
 */

const CATEGORY = 'plantao-hospitalar';
const PRIORITY = 'alta';
const ACTION_URL = 'trocasPlantaoHospitalar';
const ACTION_LABEL = 'Ver Troca';

const HOSPITAL_LABELS = {
  hro: 'HRO',
  unimed: 'UNIMED',
  plantao_pago: 'Plantão Pago',
};

const TURNO_LABELS = {
  manha: '07h–15h',
  tarde: '15h–23h',
};

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatSlot(hospital, turno) {
  const h = HOSPITAL_LABELS[hospital] || hospital;
  const t = TURNO_LABELS[turno] || turno;
  return `${h} (${t})`;
}

function describeOferta(trade) {
  if (trade?.escopo === 'dia') return `o dia ${formatDateBR(trade.dataPlantao)}`;
  return `${formatSlot(trade.hospital, trade.turno)} de ${formatDateBR(trade.dataPlantao)}`;
}

function describeRetorno(trade) {
  if (!trade?.dataDesejada) return null;
  if (trade.escopo === 'dia') return `o dia ${formatDateBR(trade.dataDesejada)}`;
  return `${formatSlot(trade.hospitalDesejado, trade.turnoDesejado)} de ${formatDateBR(trade.dataDesejada)}`;
}

const EVENTS = ['created', 'accepted', 'rejected', 'cancelled'];

export function buildPlantaoHospitalarNotificationContent(event, trade, ctx = {}) {
  if (!EVENTS.includes(event)) {
    throw new Error(`Evento inválido: ${event}`);
  }
  const actor = ctx.actorFirstName || 'Uma funcionária';
  const codigo = trade?.codigo || '—';
  const oferta = describeOferta(trade);
  const retorno = describeRetorno(trade);
  const isSwap = !!retorno;

  if (event === 'created') {
    return isSwap
      ? {
          subject: 'Nova solicitação de troca de plantão',
          content: `${actor} quer trocar ${oferta} por ${retorno}. Código: ${codigo}`,
        }
      : {
          subject: 'Nova solicitação de cobertura de plantão',
          content: `${actor} pede cobertura para ${oferta}. Código: ${codigo}`,
        };
  }

  if (event === 'accepted') {
    return {
      subject: 'Sua troca de plantão foi aceita',
      content: isSwap
        ? `${actor} aceitou trocar ${oferta} por ${retorno}. Código: ${codigo}`
        : `${actor} aceitou cobrir ${oferta}. Código: ${codigo}`,
    };
  }

  if (event === 'rejected') {
    return {
      subject: 'Sua troca de plantão foi rejeitada',
      content: `${actor} rejeitou sua solicitação (${codigo}). Você pode criar outra.`,
    };
  }

  return {
    subject: 'Troca de plantão cancelada',
    content: `${actor} cancelou a solicitação de troca (${codigo}).`,
  };
}

export function getPlantaoHospitalarNotificationRecipients(event, trade, ctx = {}) {
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

export const PLANTAO_NOTIF_META = { CATEGORY, PRIORITY, ACTION_URL, ACTION_LABEL };
export const __internal = { formatDateBR, formatSlot, EVENTS };
