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
 * @param {Array<{id: string, active?: boolean, isAdmin?: boolean, isCoordenador?: boolean, role?: string}>} users
 * @returns {string[]} Lista de Firebase UIDs dos responsáveis
 */
export function getResponsaveisIncidentes(users) {
  if (!Array.isArray(users)) return [];
  return users
    .filter((u) => {
      if (!u?.id) return false;
      if (u.active === false) return false;
      return (
        u.isAdmin === true ||
        u.isCoordenador === true ||
        u.role === 'coordenador'
      );
    })
    .map((u) => u.id);
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
