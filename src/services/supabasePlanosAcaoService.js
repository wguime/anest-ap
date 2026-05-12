/**
 * Supabase Planos de Acao (PDCA) Service
 *
 * CRUD completo + gerenciamento de fases PDCA + avaliacao de eficacia
 * Converte bidirecionalmente camelCase <-> snake_case para manter
 * compatibilidade total com hooks e componentes existentes.
 *
 * Segue o mesmo padrao de supabaseIncidentsService.js.
 *
 * Sprint 16 / F6.2 rollout: `advancePdcaPhase` e `evaluateEficacia`
 * passaram a se integrar com a offline queue + conflict replay registry.
 * Ambas são read-modify-write em `historico` (não-idempotentes por
 * default) — tratamos dedup via `entryId` determinístico em cada
 * historico entry. Veja `_doAdvancePdcaPhase` / `_doEvaluateEficacia`.
 */
import { supabase } from '@/config/supabase'
import { enqueue as enqueueOffline } from '@/utils/offlineQueue'
import { registerHandler } from '@/services/offlineQueueProcessor'
import { registerReplayHandler } from '@/services/conflictReplayRegistry'

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

// ----------------------------------------------------------------------------
// Sprint 16 / F6.2 — helpers offline queue + replay para PDCA
// ----------------------------------------------------------------------------

const PDCA_STATUS_MAP = {
  plan: 'planejamento',
  do: 'execucao',
  check: 'verificacao',
  act: 'padronizacao',
}

/**
 * Idempotência de historico: cada entry carrega um `entryId` derivado do
 * op_id determinístico do payload. Replay/retry filtra duplicatas por
 * `entryId` antes de fazer o UPDATE. Sem entry_id duplicado, sem write.
 *
 * @param {Array} existing
 * @param {string} entryId
 * @returns {boolean}
 */
function _historicoHasEntry(existing, entryId) {
  if (!Array.isArray(existing) || !entryId) return false
  return existing.some((entry) => entry && entry.entryId === entryId)
}

/**
 * Network error genérico (sem code/status PostgREST) — sinal para fallback
 * enqueue. Mesma heurística usada em supabaseDocumentService /
 * supabaseComunicadosService.
 */
function _isNetworkError(error) {
  return !error?.code && /fetch|network|failed/i.test(error?.message || '')
}

async function _doAdvancePdcaPhase(payload) {
  const { id, newPhase, autor, timestamp, opId } = payload
  const plano = await fetchById(id)

  // Replay-safety: se historico já contem entryId, é replay duplicado.
  // No-op no DB — mantemos last-write-wins do "primeiro replay" original.
  if (_historicoHasEntry(plano.historico, opId)) {
    return toCamelCase(plano)
  }

  const historico = [
    ...(plano.historico || []),
    {
      entryId: opId,
      data: timestamp,
      acao: `Fase alterada para ${newPhase}`,
      autor,
    },
  ]

  const { data, error } = await supabase
    .from('planos_acao')
    .update({
      fase_pdca: newPhase,
      status: PDCA_STATUS_MAP[newPhase] || plano.status,
      historico,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return toCamelCase(data)
}

async function _doEvaluateEficacia(payload) {
  const { id, eficaciaValue, justificativa, autor, timestamp, opId } = payload
  const plano = await fetchById(id)

  if (_historicoHasEntry(plano.historico, opId)) {
    return toCamelCase(plano)
  }

  const historicoEntry = {
    entryId: opId,
    data: timestamp,
    acao: `Eficacia avaliada como ${eficaciaValue}`,
    autor,
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

  if (error) throw error
  return toCamelCase(data)
}

// Sprint 16 / F6.2: registra handlers para flush offline.
registerHandler('planos-acao.advancePdcaPhase', _doAdvancePdcaPhase)
registerHandler('planos-acao.evaluateEficacia', _doEvaluateEficacia)

// Sprint 16 / F6.2: replay handlers para conflict queue.
// Ambos são idempotentes via entryId no historico — seguro para retry.
registerReplayHandler(
  'planos-acao.advancePdcaPhase',
  (payload /* , userInfo */) => _doAdvancePdcaPhase(payload)
)
registerReplayHandler(
  'planos-acao.evaluateEficacia',
  (payload /* , userInfo */) => _doEvaluateEficacia(payload)
)

async function advancePdcaPhase(id, newPhase, userInfo = {}) {
  const timestamp = new Date().toISOString()
  const autor = userInfo.userName || userInfo.displayName || 'Usuario'
  // op_id determinístico: mesmo plano + mesma fase alvo = mesma op,
  // mesmo se a UI re-disparar a action ou houver retry de fila.
  const opId = `planos-acao.advancePdcaPhase:${id}:${newPhase}`
  const payload = { id, newPhase, autor, timestamp, opId }

  // Modo offline: persiste na queue, devolve resposta otimista (null).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'planos-acao.advancePdcaPhase', payload })
    } catch (err) {
      handleError(err, 'advancePdcaPhase.enqueue')
    }
    return null
  }

  try {
    return await _doAdvancePdcaPhase(payload)
  } catch (error) {
    if (_isNetworkError(error)) {
      try {
        await enqueueOffline({ op: 'planos-acao.advancePdcaPhase', payload })
        return null
      } catch (enqErr) {
        handleError(enqErr, 'advancePdcaPhase.enqueue')
      }
    }
    handleError(error, 'advancePdcaPhase')
  }
}

async function evaluateEficacia(id, eficaciaValue, justificativa, userInfo = {}) {
  const timestamp = new Date().toISOString()
  const autor = userInfo.userName || userInfo.displayName || 'Usuario'
  // op_id determinístico: mesmo plano + mesmo valor de eficácia avaliado.
  const opId = `planos-acao.evaluateEficacia:${id}:${eficaciaValue}`
  const payload = {
    id,
    eficaciaValue,
    justificativa: justificativa || null,
    autor,
    timestamp,
    opId,
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      await enqueueOffline({ op: 'planos-acao.evaluateEficacia', payload })
    } catch (err) {
      handleError(err, 'evaluateEficacia.enqueue')
    }
    return null
  }

  try {
    return await _doEvaluateEficacia(payload)
  } catch (error) {
    if (_isNetworkError(error)) {
      try {
        await enqueueOffline({ op: 'planos-acao.evaluateEficacia', payload })
        return null
      } catch (enqErr) {
        handleError(enqErr, 'evaluateEficacia.enqueue')
      }
    }
    handleError(error, 'evaluateEficacia')
  }
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
