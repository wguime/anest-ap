/**
 * Supabase Auditorias Interativas Service
 *
 * CRUD completo para execucoes de auditorias interativas.
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabasePlanosAcaoService.js.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  templateId: 'template_id',
  templateTipo: 'template_tipo',
  auditorId: 'auditor_id',
  auditorNome: 'auditor_nome',
  setorId: 'setor_id',
  setorNome: 'setor_nome',
  dataAuditoria: 'data_auditoria',
  scoreConformidade: 'score_conformidade',
  observacoesGerais: 'observacoes_gerais',
  planosAcaoIds: 'planos_acao_ids',
  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  concluidoEm: 'concluido_em',
  prazo: 'prazo',
  tamanhoAmostra: 'tamanho_amostra',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key
    result[snakeKey] = value
  }
  return result
}

function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key
    result[camelKey] = value
  }
  return result
}

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[SupabaseAuditoriasService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// LEITURA
// ============================================================================

async function fetchAllExecucoes(options = {}) {
  const { status, templateTipo, setorId, limit = 100 } = options

  let query = supabase
    .from('auditoria_execucoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }
  if (templateTipo) {
    query = query.eq('template_tipo', templateTipo)
  }
  if (setorId) {
    query = query.eq('setor_id', setorId)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchAllExecucoes')
  return (data || []).map(toCamelCase)
}

async function fetchById(id) {
  const { data, error } = await supabase
    .from('auditoria_execucoes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

// ============================================================================
// ESCRITA
// ============================================================================

async function create(execucaoData, userInfo = {}) {
  const row = {
    template_id: execucaoData.templateId || null,
    template_tipo: execucaoData.templateTipo,
    titulo: execucaoData.titulo,
    auditor_id: execucaoData.auditorId || userInfo.userId || userInfo.uid || null,
    auditor_nome: execucaoData.auditorNome || userInfo.userName || userInfo.displayName || 'Usuario',
    setor_id: execucaoData.setorId || null,
    setor_nome: execucaoData.setorNome || null,
    data_auditoria: execucaoData.dataAuditoria || null,
    status: execucaoData.status || 'rascunho',
    respostas: execucaoData.respostas || {},
    score_conformidade: execucaoData.scoreConformidade || null,
    observacoes_gerais: execucaoData.observacoesGerais || null,
    evidencias: execucaoData.evidencias || [],
    planos_acao_ids: execucaoData.planosAcaoIds || [],
    tamanho_amostra: execucaoData.tamanhoAmostra || null,
    created_by: userInfo.userId || userInfo.uid || null,
  }

  const { data, error } = await supabase
    .from('auditoria_execucoes')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'create')
  return toCamelCase(data)
}

async function update(id, updates) {
  const snakeUpdates = toSnakeCase(updates)

  // Remove campos que nao devem ser atualizados diretamente
  delete snakeUpdates.id
  delete snakeUpdates.created_at
  delete snakeUpdates.created_by

  snakeUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('auditoria_execucoes')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'update')
  return toCamelCase(data)
}

async function finalize(id, score, userInfo = {}) {
  const { data, error } = await supabase
    .from('auditoria_execucoes')
    .update({
      status: 'concluida',
      score_conformidade: score,
      concluido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'finalize')
  return toCamelCase(data)
}

async function remove(id) {
  const { error } = await supabase.from('auditoria_execucoes').delete().eq('id', id)

  if (error) handleError(error, 'remove')
  return true
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToAll(callback) {
  const channel = supabase
    .channel('auditoria-execucoes-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'auditoria_execucoes' },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: payload.new ? toCamelCase(payload.new) : null,
          old: payload.old ? toCamelCase(payload.old) : null,
        })
      }
    )
    .subscribe()

  return channel
}

function unsubscribe(channel) {
  if (channel) {
    supabase.removeChannel(channel)
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseAuditoriasService = {
  fetchAllExecucoes,
  fetchById,
  create,
  update,
  finalize,
  remove,
  subscribeToAll,
  unsubscribe,
}

export { toCamelCase as auditoriasToCamelCase }

export default supabaseAuditoriasService
