/**
 * Helpers para notificação de reuniões na caixa de mensagens.
 */

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
    category: 'reuniao',
    subject: `Nova reunião agendada: ${titulo}`,
    content: `${headline} agendada para ${dataStr} às ${horario}.\nLocal: ${local}${perfisSuffix}`,
    priority: 'normal',
    actionUrl: 'reuniaoDetalhe',
    actionLabel: 'Ver Reunião',
    actionParams: { id: reuniaoId },
    relatedEntityType: 'reuniao',
    relatedEntityId: reuniaoId,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}
