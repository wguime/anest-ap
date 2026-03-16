import { supabase } from '@/config/supabase'
import supabaseDocumentService from '@/services/supabaseDocumentService'
import supabaseIncidentsService from '@/services/supabaseIncidentsService'

/**
 * Export all user data (LGPD Art. 18 - Direito de portabilidade)
 */
export async function exportUserData(userId, userProfile = {}) {
  const results = {}
  const errors = []

  // 1. User profile from Firebase (passed as parameter)
  results.perfil = {
    nome: userProfile.displayName || userProfile.firstName + ' ' + userProfile.lastName,
    email: userProfile.email,
    cargo: userProfile.role,
    crm: userProfile.crm,
  }

  // 2. Documents created by this user
  try {
    const { data } = await supabase
      .from('documentos')
      .select('id, titulo, codigo, categoria, status, created_at')
      .eq('created_by', userId)
    results.documentosCriados = data || []
  } catch (e) {
    errors.push({ source: 'documentosCriados', error: e.message })
    results.documentosCriados = []
  }

  // 3. Document changelog entries (no artificial limit)
  try {
    const allChangelog = []
    const PAGE_SIZE = 1000
    let from = 0
    let hasMore = true
    while (hasMore) {
      const { data: page } = await supabase
        .from('documento_changelog')
        .select('id, documento_id, action, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (page && page.length > 0) {
        allChangelog.push(...page)
        from += page.length
        hasMore = page.length === PAGE_SIZE
      } else {
        hasMore = false
      }
    }
    results.atividadeDocumental = allChangelog
  } catch (e) {
    errors.push({ source: 'atividadeDocumental', error: e.message })
    results.atividadeDocumental = []
  }

  // 4. Distribution records
  try {
    const { data } = await supabase
      .from('documento_distribuicao')
      .select('documento_id, distribuido_em, visualizado_em, reconhecido_em')
      .eq('user_id', userId)
    results.distribuicoes = data || []
  } catch (e) {
    errors.push({ source: 'distribuicoes', error: e.message })
    results.distribuicoes = []
  }

  // 5. Incidents by this user
  try {
    const incidents = await supabaseIncidentsService.fetchByUser(userId)
    results.incidentes = incidents.map(inc => ({
      id: inc.id,
      protocolo: inc.protocolo,
      tipo: inc.tipo,
      status: inc.status,
      createdAt: inc.createdAt,
    }))
  } catch (e) {
    errors.push({ source: 'incidentes', error: e.message })
    results.incidentes = []
  }

  // 6. Approval actions
  try {
    const { data } = await supabase
      .from('documento_aprovacoes')
      .select('id, documento_id, action, decided_at')
      .eq('approver_id', userId)
    results.aprovacoes = data || []
  } catch (e) {
    errors.push({ source: 'aprovacoes', error: e.message })
    results.aprovacoes = []
  }

  // 7. Messages sent/received
  try {
    const { data } = await supabase
      .from('messages')
      .select('id, subject, sender_id, recipient_id, priority, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    results.mensagens = data || []
  } catch (e) {
    errors.push({ source: 'mensagens', error: e.message })
    results.mensagens = []
  }

  // 8. Education progress (courses, scores, certificates)
  try {
    const { data } = await supabase
      .from('educacao_progresso')
      .select('id, curso_id, trilha_id, aula_id, status, score, completed_at, created_at')
      .eq('user_id', userId)
    results.educacaoProgresso = data || []
  } catch (e) {
    // Table may not exist yet — not a critical error
    errors.push({ source: 'educacaoProgresso', error: e.message })
    results.educacaoProgresso = []
  }

  // 9. Certificates earned
  try {
    const { data } = await supabase
      .from('educacao_certificados')
      .select('id, curso_id, trilha_id, issued_at, certificate_url')
      .eq('user_id', userId)
    results.certificados = data || []
  } catch (e) {
    errors.push({ source: 'certificados', error: e.message })
    results.certificados = []
  }

  // 10. Comunicados read confirmations
  try {
    const { data } = await supabase
      .from('comunicado_confirmacoes')
      .select('id, comunicado_id, confirmed_at')
      .eq('user_id', userId)
    results.comunicadosLidos = data || []
  } catch (e) {
    errors.push({ source: 'comunicadosLidos', error: e.message })
    results.comunicadosLidos = []
  }

  // 11. Autoavaliacoes ROP
  try {
    const { data } = await supabase
      .from('autoavaliacao_rop')
      .select('id, rop_id, rop_area, ciclo, status, avaliado_em, created_at')
      .eq('created_by', userId)
    results.autoavaliacoes = data || []
  } catch (e) {
    errors.push({ source: 'autoavaliacoes', error: e.message })
    results.autoavaliacoes = []
  }

  // 12. Planos de acao
  try {
    const { data } = await supabase
      .from('planos_acao')
      .select('id, titulo, tipo_origem, status, fase_pdca, prioridade, prazo, created_at')
      .eq('responsavel_id', userId)
    results.planosAcao = data || []
  } catch (e) {
    errors.push({ source: 'planosAcao', error: e.message })
    results.planosAcao = []
  }

  // 13. Auditorias interativas (execucoes)
  try {
    const { data } = await supabase
      .from('auditoria_execucoes')
      .select('id, titulo, template_tipo, status, data_auditoria, score_conformidade, created_at')
      .eq('auditor_id', userId)
    results.auditorias = data || []
  } catch (e) {
    errors.push({ source: 'auditorias', error: e.message })
    results.auditorias = []
  }

  return {
    exportDate: new Date().toISOString(),
    userId,
    ...results,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Request data deletion (LGPD Art. 18 - Direito de eliminacao)
 * Creates a record in the lgpd_solicitacoes table that admin must review.
 * Previously used the incidentes table with tipo='lgpd_exclusao', but that
 * violates the CHECK constraint (tipo IN ('incidente','denuncia')).
 */
export async function requestDeletion(userId, userProfile = {}) {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('userId e obrigatorio para solicitar exclusao.')
  }

  const email = userProfile?.email || ''
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email do perfil e invalido.')
  }

  const now = new Date().toISOString()
  const userName = userProfile.displayName
    || [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')
    || 'Usuario'

  let data, error
  for (let attempt = 0; attempt <= 2; attempt++) {
    const result = await supabase
      .from('lgpd_solicitacoes')
      .insert({
        tipo: 'exclusao',
        user_id: userId,
        status: 'pendente',
        dados_solicitante: {
          nome: userName,
          email: userProfile.email || '',
        },
        motivo: `Solicitacao de exclusao de dados pessoais (LGPD Art. 18) pelo usuario ${userName} (${userProfile.email || userId}).`,
      })
      .select('id, created_at')
      .single()

    data = result.data
    error = result.error
    if (!error) break
    if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }

  if (error) {
    console.error('[lgpdService] requestDeletion failed:', error)
    throw new Error('Falha ao registrar solicitacao de exclusao.')
  }

  return {
    success: true,
    message: 'Solicitacao de exclusao registrada. O administrador sera notificado.',
    requestDate: data.created_at || now,
    requestId: data.id,
    userId,
  }
}

// ============================================================================
// ADMIN functions — used by LgpdSolicitacoesTab
// ============================================================================

/**
 * Fetch all LGPD deletion requests (admin only)
 */
export async function fetchSolicitacoes() {
  const { data, error } = await supabase
    .from('lgpd_solicitacoes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Process a deletion request — anonymize user data and mark as processed
 */
export async function processSolicitacao(solicitacaoId, adminUserId, adminUserName) {
  // 1. Fetch the request to get user_id
  const { data: sol, error: fetchErr } = await supabase
    .from('lgpd_solicitacoes')
    .select('*')
    .eq('id', solicitacaoId)
    .single()

  if (fetchErr) throw fetchErr
  if (!sol) throw new Error('Solicitacao nao encontrada.')
  if (sol.status === 'processada') throw new Error('Solicitacao ja foi processada.')

  const targetUserId = sol.user_id

  // 2. Anonymize data in relevant tables
  const anonymizeErrors = []

  // Anonymize messages
  try {
    await supabase
      .from('messages')
      .update({ sender_name: '[REMOVIDO]', sender_avatar: null })
      .eq('sender_id', targetUserId)
    await supabase
      .from('messages')
      .update({ recipient_name: '[REMOVIDO]' })
      .eq('recipient_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'messages', error: e.message })
  }

  // Anonymize incidents
  try {
    await supabase
      .from('incidentes')
      .update({
        user_id: null,
        incidente_data: supabase.rpc ? undefined : null,
      })
      .eq('user_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'incidentes', error: e.message })
  }

  // Anonymize documentos (created_by_name / updated_by_name)
  try {
    await supabase
      .from('documentos')
      .update({ created_by_name: '[REMOVIDO]', created_by_email: null })
      .eq('created_by', targetUserId)
    await supabase
      .from('documentos')
      .update({ updated_by_name: '[REMOVIDO]' })
      .eq('updated_by', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'documentos', error: e.message })
  }

  // Anonymize documento_changelog (user_name / user_email)
  try {
    await supabase
      .from('documento_changelog')
      .update({ user_name: '[REMOVIDO]', user_email: null })
      .eq('user_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'documento_changelog', error: e.message })
  }

  // Anonymize documento_distribuicao (user_name)
  try {
    await supabase
      .from('documento_distribuicao')
      .update({ user_name: '[REMOVIDO]' })
      .eq('user_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'documento_distribuicao', error: e.message })
  }

  // Anonymize documento_aprovacoes (approver_name)
  try {
    await supabase
      .from('documento_aprovacoes')
      .update({ approver_name: '[REMOVIDO]' })
      .eq('approver_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'documento_aprovacoes', error: e.message })
  }

  // Anonymize educacao_progresso (no personal name fields — only user_id reference)
  // No name columns to anonymize in this table; data is non-personal (scores, status).

  // Anonymize educacao_certificados (nome_usuario)
  try {
    await supabase
      .from('educacao_certificados')
      .update({ nome_usuario: '[REMOVIDO]' })
      .eq('user_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'educacao_certificados', error: e.message })
  }

  // Anonymize comunicado_confirmacoes (user_name)
  try {
    await supabase
      .from('comunicado_confirmacoes')
      .update({ user_name: '[REMOVIDO]' })
      .eq('user_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'comunicado_confirmacoes', error: e.message })
  }

  // Anonymize autoavaliacao_rop (responsavel_nome)
  try {
    await supabase
      .from('autoavaliacao_rop')
      .update({ responsavel_nome: '[REMOVIDO]' })
      .eq('responsavel_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'autoavaliacao_rop', error: e.message })
  }

  // Anonymize planos_acao (responsavel_nome / created_by_name)
  try {
    await supabase
      .from('planos_acao')
      .update({ responsavel_nome: '[REMOVIDO]' })
      .eq('responsavel_id', targetUserId)
    await supabase
      .from('planos_acao')
      .update({ created_by_name: '[REMOVIDO]' })
      .eq('created_by', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'planos_acao', error: e.message })
  }

  // Anonymize auditoria_execucoes (auditor_nome)
  try {
    await supabase
      .from('auditoria_execucoes')
      .update({ auditor_nome: '[REMOVIDO]' })
      .eq('auditor_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'auditoria_execucoes', error: e.message })
  }

  // Anonymize lgpd_solicitacoes (dados_solicitante contains nome/email)
  try {
    await supabase
      .from('lgpd_solicitacoes')
      .update({ dados_solicitante: { nome: '[REMOVIDO]', email: '[REMOVIDO]' } })
      .eq('user_id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'lgpd_solicitacoes', error: e.message })
  }

  // Anonymize profiles (nome, email, avatar)
  try {
    await supabase
      .from('profiles')
      .update({ nome: '[REMOVIDO]', email: `removido_${targetUserId}@anon.local`, avatar: null })
      .eq('id', targetUserId)
  } catch (e) {
    anonymizeErrors.push({ table: 'profiles', error: e.message })
  }

  // 3. Mark solicitacao as processed
  const { error: updateErr } = await supabase
    .from('lgpd_solicitacoes')
    .update({
      status: 'processada',
      processado_por: adminUserId,
      processado_por_nome: adminUserName,
      processado_em: new Date().toISOString(),
      resultado: {
        anonymizeErrors: anonymizeErrors.length > 0 ? anonymizeErrors : undefined,
      },
    })
    .eq('id', solicitacaoId)

  if (updateErr) throw updateErr

  return { success: true, errors: anonymizeErrors }
}

/**
 * Download data as JSON file
 */
export function downloadAsJson(data, filename = 'meus-dados-anest.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default {
  exportUserData,
  requestDeletion,
  downloadAsJson,
  fetchSolicitacoes,
  processSolicitacao,
}
