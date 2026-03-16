/**
 * Notification Service — In-App Notifications
 *
 * Each function accepts a `notify` callback that should be
 * MessagesContext.createSystemNotification bound from the calling component.
 *
 * All functions pass through `recipientId` (single) or `recipientIds` (array)
 * so that createSystemNotification can persist targeted notifications to Supabase.
 */

// ============================================================================
// DOCUMENTOS
// ============================================================================

export function notifyDistribution(notify, { docTitle, recipientId, recipientIds }) {
  notify({
    category: 'documento',
    subject: 'Novo documento distribuído',
    content: `Você recebeu o documento: ${docTitle}`,
    senderName: 'Gestão Documental',
    priority: 'normal',
    dismissable: true,
    recipientId,
    recipientIds,
  })
}

export function notifyApprovalNeeded(notify, { docTitle, recipientId }) {
  notify({
    category: 'documento',
    subject: 'Aprovação pendente',
    content: `Documento aguardando sua aprovação: ${docTitle}`,
    senderName: 'Gestão Documental',
    priority: 'alta',
    dismissable: true,
    recipientId,
  })
}

export function notifyReviewDue(notify, { docTitle, daysLeft, recipientId }) {
  notify({
    category: 'qualidade',
    subject: 'Revisão pendente',
    content: `Revisão pendente em ${daysLeft} dias: ${docTitle}`,
    senderName: 'Gestão Documental',
    priority: daysLeft <= 7 ? 'urgente' : 'normal',
    dismissable: true,
    recipientId,
  })
}

export function notifyApprovalResult(notify, { docTitle, action, approverName, recipientId }) {
  notify({
    category: 'documento',
    subject: action === 'approved' ? 'Documento aprovado' : 'Documento rejeitado',
    content: `${docTitle} foi ${action === 'approved' ? 'aprovado' : 'rejeitado'} por ${approverName}`,
    senderName: 'Gestão Documental',
    priority: 'normal',
    dismissable: true,
    recipientId,
  })
}

export function notifyDocumentoAtualizado(notify, { docTitle, versao, recipientIds }) {
  notify({
    category: 'documento',
    subject: 'Nova versão disponível',
    content: `O documento "${docTitle}" foi atualizado para a versão ${versao || 'nova'}`,
    senderName: 'Gestão Documental',
    priority: 'normal',
    dismissable: true,
    recipientIds,
  })
}

// ============================================================================
// INCIDENTES
// ============================================================================

export function notifyStatusChange(notify, { protocolo, newStatus, recipientId, recipientIds }) {
  const statusLabels = {
    pending: 'Pendente',
    in_review: 'Em Análise',
    investigating: 'Em Investigação',
    action_required: 'Ação Requerida',
    resolved: 'Resolvido',
    closed: 'Encerrado',
  }
  notify({
    category: 'incidente',
    subject: 'Status alterado',
    content: `Incidente ${protocolo}: status alterado para ${statusLabels[newStatus] || newStatus}`,
    senderName: 'Comitê de Segurança',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'incidenteDetalhe',
    actionLabel: 'Ver Incidente',
    recipientId,
    recipientIds,
  })
}

export function notifyNewIncident(notify, { protocolo, tipo, recipientIds }) {
  notify({
    category: 'incidente',
    subject: tipo === 'denuncia' ? 'Nova denúncia registrada' : 'Novo incidente registrado',
    content: `${tipo === 'denuncia' ? 'Denúncia' : 'Incidente'} registrado: ${protocolo}`,
    senderName: 'Sistema de Incidentes',
    priority: 'alta',
    dismissable: true,
    actionUrl: 'incidentes',
    actionLabel: tipo === 'denuncia' ? 'Ver Denúncias' : 'Ver Incidentes',
    recipientIds,
  })
}

export function notifyDeadlineReminder(notify, { protocolo, nextStatusLabel, deadline, riskLevel, tipo, recipientId }) {
  const tipoLabel = tipo === 'denuncia' ? 'denúncia' : 'incidente';
  notify({
    category: 'incidente',
    subject: `Prazo se aproxima: ${protocolo}`,
    content: `O ${tipoLabel} ${protocolo} precisa avançar para "${nextStatusLabel}" até ${deadline}. Nível de risco: ${riskLevel}.`,
    senderName: 'Sistema de Incidentes',
    priority: 'urgente',
    dismissable: true,
    recipientId,
  })
}

// ============================================================================
// COMUNICADOS
// ============================================================================

export function notifyComunicadoPublicado(notify, { titulo, tipo, recipientIds }) {
  notify({
    category: 'comunicado',
    subject: `${tipo || 'Comunicado'}: ${titulo}`,
    content: `Novo comunicado publicado: ${titulo}`,
    senderName: 'Sistema de Comunicados',
    priority: tipo === 'Urgente' ? 'urgente' : tipo === 'Importante' ? 'alta' : 'normal',
    dismissable: tipo !== 'Urgente',
    actionUrl: 'comunicados',
    actionLabel: 'Ler Comunicado',
    recipientIds,
  })
}

export function notifyAcaoRequerida(notify, { comunicadoTitle, acao, recipientIds }) {
  notify({
    category: 'comunicado',
    subject: `Ação requerida: ${comunicadoTitle}`,
    content: `Você tem uma ação pendente: ${acao}`,
    senderName: 'Sistema de Comunicados',
    priority: 'alta',
    dismissable: false,
    actionUrl: 'comunicados',
    actionLabel: 'Ver Ação',
    recipientIds,
  })
}

// ============================================================================
// EDUCACAO
// ============================================================================

export function notifyNovoCurso(notify, { cursoTitle, recipientIds }) {
  notify({
    category: 'educacao',
    subject: 'Novo curso disponível',
    content: `O curso "${cursoTitle}" está disponível para você`,
    senderName: 'Educação Continuada',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Ver Curso',
    recipientIds,
  })
}

export function notifyCursoDeadline(notify, { cursoTitle, daysLeft, recipientId }) {
  notify({
    category: 'educacao',
    subject: `Prazo se aproxima: ${cursoTitle}`,
    content: `Faltam ${daysLeft} dias para concluir o curso obrigatório "${cursoTitle}"`,
    senderName: 'Educação Continuada',
    priority: daysLeft <= 3 ? 'urgente' : 'alta',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Continuar Curso',
    recipientId,
  })
}

export function notifyCursoConcluido(notify, { cursoTitle, recipientId }) {
  notify({
    category: 'educacao',
    subject: 'Curso concluído!',
    content: `Parabéns! Você concluiu o curso "${cursoTitle}"`,
    senderName: 'Educação Continuada',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Ver Certificado',
    recipientId,
  })
}

export function notifyCertificadoDisponivel(notify, { cursoTitle, recipientId }) {
  notify({
    category: 'educacao',
    subject: 'Certificado disponível',
    content: `Seu certificado do curso "${cursoTitle}" está pronto para download`,
    senderName: 'Educação Continuada',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Ver Certificado',
    recipientId,
  })
}

// ============================================================================
// PLANTOES / FERIAS
// ============================================================================

export function notifyPlantaoReminder(notify, {
  profissionalNome, setor, horario, dataPlantao, tipoLembrete, recipientId, relatedEntityId,
}) {
  const eh1Dia = tipoLembrete === '1day'
  notify({
    category: 'plantao',
    subject: eh1Dia ? `Plantão amanhã: ${setor}` : `Plantão em 1 hora: ${setor}`,
    content: eh1Dia
      ? `Você tem plantão amanhã (${dataPlantao}) no ${setor} às ${horario}`
      : `Seu plantão no ${setor} começa em 1 hora (${horario})`,
    senderName: 'Escala de Plantões',
    priority: eh1Dia ? 'normal' : 'alta',
    dismissable: true,
    actionUrl: 'escalas',
    actionLabel: 'Ver Escala',
    recipientId,
    relatedEntityType: 'plantao',
    relatedEntityId,
  })
}

export function notifyFeriasReminder(notify, {
  profissionalNome, periodo, recipientId, relatedEntityId,
}) {
  notify({
    category: 'plantao',
    subject: 'Férias iniciam amanhã',
    content: `Suas férias começam amanhã (${periodo}). Bom descanso!`,
    senderName: 'Escala de Plantões',
    priority: 'normal',
    dismissable: true,
    recipientId,
    relatedEntityType: 'ferias',
    relatedEntityId,
  })
}

export default {
  notifyDistribution,
  notifyApprovalNeeded,
  notifyReviewDue,
  notifyStatusChange,
  notifyNewIncident,
  notifyApprovalResult,
  notifyDeadlineReminder,
  notifyDocumentoAtualizado,
  notifyComunicadoPublicado,
  notifyAcaoRequerida,
  notifyNovoCurso,
  notifyCursoDeadline,
  notifyCursoConcluido,
  notifyCertificadoDisponivel,
  notifyPlantaoReminder,
  notifyFeriasReminder,
}
