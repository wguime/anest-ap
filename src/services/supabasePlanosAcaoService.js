/**
 * Supabase Planos de Acao (PDCA) Service
 *
 * CRUD completo + gerenciamento de fases PDCA + avaliacao de eficacia
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseIncidentsService.js.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  tipoOrigem: 'tipo_origem',
  origemId: 'origem_id',
  origemDescricao: 'origem_descricao',
  fasePdca: 'fase_pdca',
  responsavelId: 'responsavel_id',
  responsavelNome: 'responsavel_nome',
  createdBy: 'created_by',
  createdByName: 'created_by_name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  planAnalise: 'plan_analise',
  planAcoes: 'plan_acoes',
  doNotas: 'do_notas',
  checkResultados: 'check_resultados',
  actPadronizacao: 'act_padronizacao',
  planOQue: 'plan_o_que',
  planPorque: 'plan_porque',
  planOnde: 'plan_onde',
  planComo: 'plan_como',
  planQuanto: 'plan_quanto',
  planMeta: 'plan_meta',
  planIndicador: 'plan_indicador',
  doPercentual: 'do_percentual',
  doDificuldades: 'do_dificuldades',
  checkMetaAtingida: 'check_meta_atingida',
  checkAnalise: 'check_analise',
  actDecisao: 'act_decisao',
  actLicoesAprendidas: 'act_licoes_aprendidas',
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
  console.error(`[SupabasePlanosAcaoService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// LEITURA
// ============================================================================

async function fetchAll(options = {}) {
  const { status, fasePdca, prioridade, limit = 100 } = options

  let query = supabase
    .from('planos_acao')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }
  if (fasePdca) {
    query = query.eq('fase_pdca', fasePdca)
  }
  if (prioridade) {
    query = query.eq('prioridade', prioridade)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchAll')
  return (data || []).map(toCamelCase)
}

async function fetchById(id) {
  const { data, error } = await supabase
    .from('planos_acao')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

async function fetchByOrigem(tipoOrigem, origemId) {
  const { data, error } = await supabase
    .from('planos_acao')
    .select('*')
    .eq('tipo_origem', tipoOrigem)
    .eq('origem_id', origemId)
    .order('created_at', { ascending: false })

  if (error) handleError(error, 'fetchByOrigem')
  return (data || []).map(toCamelCase)
}

async function fetchOverdue() {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('planos_acao')
    .select('*')
    .lt('prazo', today)
    .not('status', 'in', '(concluido,cancelado)')
    .order('prazo', { ascending: true })

  if (error) handleError(error, 'fetchOverdue')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// ESCRITA
// ============================================================================

async function create(planoData, userInfo = {}) {
  const row = {
    titulo: planoData.titulo,
    descricao: planoData.descricao,
    tipo_origem: planoData.tipoOrigem,
    origem_id: planoData.origemId || null,
    origem_descricao: planoData.origemDescricao || null,
    status: planoData.status || 'planejamento',
    fase_pdca: planoData.fasePdca || 'plan',
    responsavel_id: planoData.responsavelId,
    responsavel_nome: planoData.responsavelNome,
    prazo: planoData.prazo,
    prioridade: planoData.prioridade || 'media',
    eficacia: planoData.eficacia || null,
    evidencias: planoData.evidencias || [],
    historico: planoData.historico || [],
    tags: planoData.tags || [],
    created_by: userInfo.userId || userInfo.uid || null,
    created_by_name: userInfo.userName || userInfo.displayName || 'Usuario',
  }

  const { data, error } = await supabase
    .from('planos_acao')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'create')
  return toCamelCase(data)
}

async function update(id, updates, userInfo = {}) {
  const snakeUpdates = toSnakeCase(updates)

  // Remove campos que nao devem ser atualizados diretamente
  delete snakeUpdates.id
  delete snakeUpdates.created_at
  delete snakeUpdates.created_by
  delete snakeUpdates.created_by_name

  snakeUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('planos_acao')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'update')
  return toCamelCase(data)
}

async function advancePdcaPhase(id, newPhase, userInfo = {}) {
  // Buscar plano atual para historico
  const plano = await fetchById(id)

  const historico = [
    ...(plano.historico || []),
    {
      data: new Date().toISOString(),
      acao: `Fase alterada para ${newPhase}`,
      autor: userInfo.userName || userInfo.displayName || 'Usuario',
    },
  ]

  // Mapear fase para status correspondente
  const statusMap = {
    plan: 'planejamento',
    do: 'execucao',
    check: 'verificacao',
    act: 'padronizacao',
  }

  const { data, error } = await supabase
    .from('planos_acao')
    .update({
      fase_pdca: newPhase,
      status: statusMap[newPhase] || plano.status,
      historico,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'advancePdcaPhase')
  return toCamelCase(data)
}

async function evaluateEficacia(id, eficaciaValue, justificativa, userInfo = {}) {
  // Buscar plano atual para historico
  const plano = await fetchById(id)

  const historicoEntry = {
    data: new Date().toISOString(),
    acao: `Eficacia avaliada como ${eficaciaValue}`,
    autor: userInfo.userName || userInfo.displayName || 'Usuario',
  }
  if (justificativa) historicoEntry.justificativa = justificativa

  const historico = [...(plano.historico || []), historicoEntry]

  const { data, error } = await supabase
    .from('planos_acao')
    .update({
      eficacia: eficaciaValue,
      historico,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'evaluateEficacia')
  return toCamelCase(data)
}

async function remove(id) {
  const { error } = await supabase.from('planos_acao').delete().eq('id', id)

  if (error) handleError(error, 'remove')
  return true
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToAll(callback) {
  const channel = supabase
    .channel('planos-acao-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planos_acao' },
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

const supabasePlanosAcaoService = {
  fetchAll,
  fetchById,
  fetchByOrigem,
  fetchOverdue,
  create,
  update,
  advancePdcaPhase,
  evaluateEficacia,
  remove,
  subscribeToAll,
  unsubscribe,
}

export { toCamelCase as planosAcaoToCamelCase }

export default supabasePlanosAcaoService
