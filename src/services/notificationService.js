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

/**
 * Notificação de revisão se aproximando (T-30 / T-7 / T-0).
 * Equivalente client-side ao trigger SQL `notify_pending_review_approachers`,
 * útil quando queremos disparar imediatamente após uma ação de UI.
 */
export function notifyReviewApproaching(notify, { docTitle, docId, daysUntil, recipientId }) {
  const priority = daysUntil <= 0 ? 'urgente' : daysUntil <= 7 ? 'alta' : 'normal'
  notify({
    category: 'qualidade',
    subject: 'Revisão de documento aproximando',
    content: `${docTitle} — revisão em ${Math.max(0, daysUntil)} dia(s)`,
    senderName: 'Gestão Documental',
    priority,
    dismissable: true,
    recipientId,
    relatedEntityType: 'documento',
    relatedEntityId: docId,
  })
}

/**
 * Notificação de revisão atrasada (T+1 / T+7 / T+30).
 * Equivalente client-side ao trigger SQL `notify_overdue_reviews`.
 */
export function notifyReviewOverdue(notify, { docTitle, docId, daysOverdue, recipientId }) {
  notify({
    category: 'qualidade',
    subject: 'Revisão atrasada',
    content: `${docTitle} — atrasada há ${Math.max(0, daysOverdue)} dia(s)`,
    senderName: 'Gestão Documental',
    priority: 'urgente',
    dismissable: true,
    recipientId,
    relatedEntityType: 'documento',
    relatedEntityId: docId,
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

// ============================================================================
// notifyUser — generic user-targeted notification (Wave 3 / W3-5)
// ----------------------------------------------------------------------------
// Direct adapter that resolves Supabase messages service lazily and writes a
// notification row. Usable by any caller that has a userId + payload, without
// having to wire createSystemNotification through props.
//
// Supported payload `type` values map to standard subjects/contents below.
// Unknown types fall through and are written verbatim using payload fields.
//
// Returns a Promise. Errors are swallowed (logged) so notification failures
// never block the caller's main flow (approve/reject mutation, etc).
// ============================================================================
export async function notifyUser(userId, payload = {}) {
  if (!userId) {
    console.warn('[notifyUser] missing userId — notification skipped')
    return null
  }

  const { type, docId, docTitle, comment, category = 'documento', actorName } = payload

  let subject = payload.subject
  let content = payload.content
  let priority = payload.priority || 'normal'
  let actionUrl = payload.actionUrl || 'documentos'
  let actionLabel = payload.actionLabel || 'Ver Documento'

  if (type === 'document_approved') {
    subject = subject || 'Documento aprovado'
    content = content || `${docTitle || 'Seu documento'} foi aprovado${actorName ? ` por ${actorName}` : ''}${comment ? ` — ${comment}` : ''}`
    priority = priority || 'normal'
  } else if (type === 'document_rejected') {
    subject = subject || 'Documento rejeitado'
    content = content || `${docTitle || 'Seu documento'} foi rejeitado${actorName ? ` por ${actorName}` : ''}${comment ? ` — ${comment}` : ''}`
    priority = priority || 'alta'
  } else if (type === 'approval_pending') {
    subject = subject || 'Aprovação pendente'
    content = content || `Documento aguardando sua aprovação: ${docTitle || ''}`
    priority = priority || 'alta'
  }

  if (!subject) {
    console.warn('[notifyUser] missing subject — notification skipped', payload)
    return null
  }

  try {
    const mod = await import('@/services/supabaseMessagesService')
    const svc = mod.default
    return await svc.createNotification({
      recipientId: userId,
      category,
      subject,
      content,
      senderName: payload.senderName || 'Gestão Documental',
      priority,
      actionUrl,
      actionLabel,
      actionParams: docId ? { id: docId } : payload.actionParams || null,
      relatedEntityType: payload.relatedEntityType || (docId ? 'documento' : null),
      relatedEntityId: payload.relatedEntityId || docId || null,
      dismissable: payload.dismissable !== false,
    })
  } catch (err) {
    console.error('[notifyUser] failed:', err?.message || err)
    return null
  }
}

/**
 * notifyUsers — fanout helper for multiple recipients.
 * Used by the ApprovalQueue real-time subscription to alert all admins
 * when a new document enters PENDENTE status.
 */
export async function notifyUsers(userIds = [], payload = {}) {
  const ids = (userIds || []).filter(Boolean)
  if (ids.length === 0) return []
  return Promise.all(ids.map((uid) => notifyUser(uid, payload)))
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

export function notifyComunicadoPublicado(notify, { titulo, tipo, recipientIds, comunicadoId }) {
  notify({
    category: 'comunicado',
    subject: `${tipo || 'Comunicado'}: ${titulo}`,
    content: `Novo comunicado publicado: ${titulo}`,
    senderName: 'Sistema de Comunicados',
    priority: tipo === 'Urgente' ? 'urgente' : tipo === 'Importante' ? 'alta' : 'normal',
    dismissable: tipo !== 'Urgente',
    actionUrl: 'comunicados',
    actionLabel: 'Ler Comunicado',
    actionParams: comunicadoId ? { comunicadoId } : null,
    relatedEntityType: 'comunicado',
    relatedEntityId: comunicadoId || null,
    recipientIds,
  })
}

export function notifyAcaoRequerida(notify, { comunicadoTitle, acao, recipientIds, comunicadoId }) {
  notify({
    category: 'comunicado',
    subject: `Ação requerida: ${comunicadoTitle}`,
    content: `Você tem uma ação pendente: ${acao}`,
    senderName: 'Sistema de Comunicados',
    priority: 'alta',
    dismissable: false,
    actionUrl: 'comunicados',
    actionLabel: 'Ver Ação',
    actionParams: comunicadoId ? { comunicadoId } : null,
    relatedEntityType: 'comunicado',
    relatedEntityId: comunicadoId || null,
    recipientIds,
  })
}

// ============================================================================
// EDUCACAO
// ============================================================================

export function notifyNovoCurso(notify, { cursoTitle, cursoId, recipientIds }) {
  notify({
    category: 'educacao',
    subject: 'Novo curso disponível',
    content: `O curso "${cursoTitle}" está disponível para você`,
    senderName: 'Educação Continuada',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Ver Curso',
    actionParams: cursoId ? { cursoId } : null,
    relatedEntityType: 'curso',
    relatedEntityId: cursoId || null,
    recipientIds,
  })
}

/**
 * Notifica conteúdo novo publicado em Educação Continuada.
 * @param {function} notify - createSystemNotification
 * @param {{ tipo: 'trilha'|'curso'|'modulo'|'aula', titulo: string, entityId: string, recipientIds: string[] }} args
 */
export function notifyNovoConteudoEducacao(notify, { tipo, titulo, entityId, recipientIds }) {
  const labelByTipo = {
    trilha: 'trilha',
    curso: 'curso',
    modulo: 'módulo',
    aula: 'aula',
  };
  const label = labelByTipo[tipo] || 'conteúdo';
  notify({
    category: 'educacao',
    subject: `Nova ${label} publicada: ${titulo}`,
    content: `Uma nova ${label} "${titulo}" foi disponibilizada em Educação Continuada.`,
    senderName: 'Educação Continuada',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Ver em Educação',
    actionParams: { tipo, entityId },
    relatedEntityType: tipo,
    relatedEntityId: entityId,
    recipientIds: (recipientIds || []).filter(Boolean),
  });
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
  _profissionalNome, setor, horario, dataPlantao, tipoLembrete, recipientId, relatedEntityId,
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

export function notifyPlantaoResidenteReminder(notify, {
  setor, horario, dataPlantao, tipoLembrete, recipientId, relatedEntityId,
}) {
  const eh1Dia = tipoLembrete === '1day'
  notify({
    category: 'plantao',
    subject: eh1Dia ? `Plantão amanhã: ${setor}` : `Plantão em 1 hora: ${setor}`,
    content: eh1Dia
      ? `Você está escalado(a) para plantão amanhã (${dataPlantao}) no ${setor} a partir de ${horario}`
      : `Seu plantão no ${setor} começa em 1 hora (${horario})`,
    senderName: 'Escala de Residência',
    priority: eh1Dia ? 'normal' : 'alta',
    dismissable: true,
    actionUrl: 'residencia',
    actionLabel: 'Ver Residência',
    actionParams: { dataPlantao },
    recipientId,
    relatedEntityType: 'plantao-residencia',
    relatedEntityId,
  })
}

export function notifyFeriasReminder(notify, {
  _profissionalNome, periodo, recipientId, relatedEntityId,
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

// ============================================================================
// SOBREAVISO MATERNO + PLANTÃO HOSPITALAR (FUNCIONÁRIAS)
// ============================================================================

export function notifySobreavisoFuncionariaReminder(notify, {
  dataPlantao, tipoLembrete, recipientId, relatedEntityId,
}) {
  const eh1Dia = tipoLembrete === '1day'
  notify({
    category: 'plantao',
    subject: eh1Dia ? 'Sobreaviso materno amanhã' : 'Hoje você está de sobreaviso',
    content: eh1Dia
      ? `Você está escalada para sobreaviso materno em ${dataPlantao} (19h às 07h)`
      : `Sobreaviso materno hoje, ${dataPlantao}, das 19h às 07h`,
    senderName: 'Escala de Sobreaviso',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'consultaSobreaviso',
    actionLabel: 'Ver Sobreaviso',
    recipientId,
    relatedEntityType: 'sobreaviso',
    relatedEntityId,
  })
}

const HOSPITAL_LABELS = { hro: 'HRO', unimed: 'UNIMED', plantao_pago: 'Plantão Pago' }
const TURNO_LABELS = { manha: '07h–15h', tarde: '15h–23h' }

export function notifyHospitalFuncionariaReminder(notify, {
  dataPlantao, hospital, turno, tipoLembrete, recipientId, relatedEntityId,
}) {
  const eh1Dia = tipoLembrete === '1day'
  const h = HOSPITAL_LABELS[hospital] || hospital
  const t = TURNO_LABELS[turno] || turno
  notify({
    category: 'plantao',
    subject: eh1Dia ? `Plantão ${h} amanhã` : `Hoje você tem plantão ${h}`,
    content: eh1Dia
      ? `Você está escalada para ${h} (${t}) em ${dataPlantao}`
      : `${h} ${t} hoje, ${dataPlantao}`,
    senderName: 'Escala Hospitalar',
    priority: 'normal',
    dismissable: true,
    actionUrl: 'escalasFuncionarias',
    actionLabel: 'Ver Escala',
    recipientId,
    relatedEntityType: 'plantao-hospitalar',
    relatedEntityId,
  })
}

export default {
  notifyUser,
  notifyUsers,
  notifyDistribution,
  notifyApprovalNeeded,
  notifyReviewDue,
  notifyReviewApproaching,
  notifyReviewOverdue,
  notifyStatusChange,
  notifyNewIncident,
  notifyApprovalResult,
  notifyDeadlineReminder,
  notifyDocumentoAtualizado,
  notifyComunicadoPublicado,
  notifyAcaoRequerida,
  notifyNovoCurso,
  notifyNovoConteudoEducacao,
  notifyCursoDeadline,
  notifyCursoConcluido,
  notifyCertificadoDisponivel,
  notifyPlantaoReminder,
  notifyPlantaoResidenteReminder,
  notifyFeriasReminder,
  notifySobreavisoFuncionariaReminder,
  notifyHospitalFuncionariaReminder,
}
