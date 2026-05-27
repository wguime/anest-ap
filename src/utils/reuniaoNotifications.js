/**
 * Helpers para notificação de reuniões na caixa de mensagens.
 *
 * Cada builder retorna um payload pronto para `createSystemNotification(payload)`.
 * Convenção: recipientIds são filtrados (falsy removido) em cada builder.
 */

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Filtra falsy de arrays de IDs */
const cleanIds = (ids) => (ids || []).filter(Boolean);

/** Base comum a todos os payloads de reunião */
function basePayload(reuniaoId, recipientIds) {
  return {
    category: 'reuniao',
    actionUrl: 'reuniaoDetalhe',
    actionLabel: 'Ver Reunião',
    actionParams: { id: reuniaoId },
    relatedEntityType: 'reuniao',
    relatedEntityId: reuniaoId,
    recipientIds: cleanIds(recipientIds),
  };
}

// ---------------------------------------------------------------------------
// 1. Nova reunião (já existia)
// ---------------------------------------------------------------------------

/**
 * Monta o payload de createSystemNotification para uma nova reunião.
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   dataReuniao: Date,
 *   horario: string,
 *   local: string,
 *   tipoLabel?: string,
 *   perfilLabels?: string,
 *   recipientIds: string[],
 * }} args
 * @returns {object} payload pronto para createSystemNotification
 */
export function buildReuniaoNotificationPayload({
  reuniaoId,
  titulo,
  dataReuniao,
  horario,
  local,
  tipoLabel,
  perfilLabels,
  recipientIds,
}) {
  const dataStr = dataReuniao?.toLocaleDateString
    ? dataReuniao.toLocaleDateString('pt-BR')
    : '';
  const headline = tipoLabel || 'Reunião';
  const perfisSuffix = perfilLabels ? `\nConvocados: ${perfilLabels}` : '';

  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `Nova reunião agendada: ${titulo}`,
    content: `${headline} agendada para ${dataStr} às ${horario}.\nLocal: ${local}${perfisSuffix}`,
    priority: 'normal',
  };
}

// ---------------------------------------------------------------------------
// 2. Reunião atualizada (data/horário/local)
// ---------------------------------------------------------------------------

/**
 * Payload para quando dados da reunião mudam (reagendamento, etc.).
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   changeDescription: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildReuniaoUpdatePayload({ reuniaoId, titulo, changeDescription, recipientIds }) {
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `Reunião atualizada: ${titulo}`,
    content: changeDescription,
    priority: 'normal',
  };
}

// ---------------------------------------------------------------------------
// 3. Cancelamento
// ---------------------------------------------------------------------------

/**
 * Payload para cancelamento de reunião (prioridade alta).
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   motivo?: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildReuniaoCancelPayload({ reuniaoId, titulo, motivo, recipientIds }) {
  const motivoSuffix = motivo ? `\nMotivo: ${motivo}` : '';
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `Reunião cancelada: ${titulo}`,
    content: `A reunião "${titulo}" foi cancelada.${motivoSuffix}`,
    priority: 'alta',
  };
}

// ---------------------------------------------------------------------------
// 4. Mudança de status genérica (exceto cancelamento — use buildReuniaoCancelPayload)
// ---------------------------------------------------------------------------

/** Mapa de status → rótulo legível */
const STATUS_LABELS = {
  agendada: 'Agendada',
  em_preparacao: 'Em Preparação',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

/**
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   newStatus: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildReuniaoStatusPayload({ reuniaoId, titulo, newStatus, recipientIds }) {
  const label = STATUS_LABELS[newStatus] || newStatus;
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `Status da reunião: ${titulo}`,
    content: `A reunião "${titulo}" agora está com status "${label}".`,
    priority: 'normal',
  };
}

// ---------------------------------------------------------------------------
// 5. Documento adicionado (ata / subsídio / outros)
// ---------------------------------------------------------------------------

/** Mapa tipo → rótulo legível */
const DOC_TYPE_LABELS = {
  ata: 'Ata',
  subsidio: 'Subsídio',
  pauta: 'Pauta',
  outros: 'Documento',
};

/**
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   tipoDocumento: string,
 *   docTitulo?: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildReuniaoDocumentoPayload({ reuniaoId, titulo, tipoDocumento, docTitulo, recipientIds }) {
  const tipoLabel = DOC_TYPE_LABELS[tipoDocumento] || tipoDocumento;
  const docSuffix = docTitulo ? `: "${docTitulo}"` : '';
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `${tipoLabel} adicionado(a): ${titulo}`,
    content: `Um novo documento do tipo ${tipoLabel} foi adicionado à reunião "${titulo}"${docSuffix}.`,
    priority: 'normal',
  };
}

// ---------------------------------------------------------------------------
// 6. Participante adicionado / removido
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   action: 'adicionado' | 'removido',
 *   recipientIds: string[],
 * }} args
 */
export function buildReuniaoParticipantePayload({ reuniaoId, titulo, action, recipientIds }) {
  const verb = action === 'removido' ? 'removido(a) da' : 'adicionado(a) à';
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: action === 'removido'
      ? `Você foi removido(a) da reunião: ${titulo}`
      : `Você foi adicionado(a) à reunião: ${titulo}`,
    content: `Você foi ${verb} reunião "${titulo}".`,
    priority: action === 'removido' ? 'alta' : 'normal',
  };
}

// ---------------------------------------------------------------------------
// 7. Deliberação aberta
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   deliberacaoNumero: string,
 *   deliberacaoTitulo: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildDeliberacaoAbertaPayload({
  reuniaoId, titulo, deliberacaoNumero, deliberacaoTitulo, recipientIds,
}) {
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `Votação aberta: ${deliberacaoTitulo}`,
    content: `Deliberação ${deliberacaoNumero} aberta na reunião "${titulo}". Registre seu voto.`,
    priority: 'normal',
  };
}

// ---------------------------------------------------------------------------
// 8. Deliberação fechada
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   reuniaoId: string,
 *   titulo: string,
 *   deliberacaoNumero: string,
 *   deliberacaoTitulo: string,
 *   resultado: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildDeliberacaoFechadaPayload({
  reuniaoId, titulo, deliberacaoNumero, deliberacaoTitulo, resultado, recipientIds,
}) {
  const resultadoLabel = { aprovada: 'Aprovada', rejeitada: 'Rejeitada', adiada: 'Adiada' }[resultado] || resultado;
  return {
    ...basePayload(reuniaoId, recipientIds),
    subject: `Deliberação ${resultadoLabel}: ${deliberacaoTitulo}`,
    content: `Deliberação ${deliberacaoNumero} na reunião "${titulo}" encerrada: ${resultadoLabel}.`,
    priority: 'normal',
  };
}
