/**
 * Resolve quais usuários são "responsáveis por incidentes/denúncias"
 * e devem receber notificações com conteúdo sensível.
 *
 * Critério: usuários ativos com isAdmin OU isCoordenador OU role 'coordenador'.
 *
 * LGPD: notificações sobre incidentes/denúncias NÃO devem conter dados do
 * notificante/denunciante, dados clínicos nem descrição. Apenas protocolo
 * e link para o painel de gestão.
 */

/**
 * Ids dos responsáveis opt-in de um tipo, marcados no Centro de Gestão
 * (incident_notification_settings: receberIncidentes/receberDenuncias + notificarApp).
 * Decisão do dono 04/09/2026: NUNCA cai para admin/coordenador — quem não está
 * marcado não é avisado. O aviso de relato NOVO é do trigger do banco; este
 * helper serve às notificações disparadas pelo cliente (mudança de status).
 * @param {Array<{id:string, receberIncidentes?:boolean, receberDenuncias?:boolean, notificarApp?:boolean}>} responsibles
 * @param {'incidente'|'denuncia'} tipo
 * @returns {string[]}
 */
export function getResponsaveisOptIn(responsibles, tipo) {
  if (!Array.isArray(responsibles)) return [];
  const flag = tipo === 'denuncia' ? 'receberDenuncias' : 'receberIncidentes';
  return responsibles
    .filter((r) => r?.id && r[flag] === true && r.notificarApp !== false)
    .map((r) => r.id);
}

/**
 * Monta payload LGPD-safe para notificar responsáveis sobre novo relato.
 * NÃO inclui nome do notificante, descrição, nem dados clínicos.
 */
export function buildNewIncidentNotificationPayload({ tipo, protocolo, incidenteId, recipientIds }) {
  const isDenuncia = tipo === 'denuncia';
  return {
    category: 'incidente',
    subject: isDenuncia ? 'Nova denúncia registrada' : 'Novo incidente registrado',
    content: `${isDenuncia ? 'Denúncia' : 'Incidente'} protocolo ${protocolo} registrado — requer análise.`,
    senderName: 'Sistema de Qualidade',
    priority: 'alta',
    actionUrl: isDenuncia ? 'denuncias' : 'incidentes',
    actionLabel: isDenuncia ? 'Ver Denúncia' : 'Ver Incidente',
    actionParams: { protocolo, incidenteId },
    relatedEntityType: isDenuncia ? 'denuncia' : 'incidente',
    relatedEntityId: incidenteId || protocolo,
    dismissable: true,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}

/**
 * Payload de mudança de status (também restrito aos responsáveis).
 */
export function buildStatusChangeNotificationPayload({ tipo, protocolo, incidenteId, newStatus, recipientIds }) {
  const isDenuncia = tipo === 'denuncia';
  return {
    category: 'incidente',
    subject: `Status atualizado: ${protocolo}`,
    content: `${isDenuncia ? 'Denúncia' : 'Incidente'} ${protocolo} — novo status: ${newStatus}`,
    senderName: 'Sistema de Qualidade',
    priority: 'normal',
    actionUrl: isDenuncia ? 'denuncias' : 'incidentes',
    actionLabel: 'Ver detalhe',
    actionParams: { protocolo, incidenteId },
    relatedEntityType: isDenuncia ? 'denuncia' : 'incidente',
    relatedEntityId: incidenteId || protocolo,
    dismissable: true,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}
