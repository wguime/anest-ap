/**
 * Supabase Cateter Peridural Service
 *
 * CRUD + follow-up management for epidural catheters.
 * Converts bidirectionally camelCase <-> snake_case.
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================

const CAMEL_TO_SNAKE = {
  dataCirurgia: 'data_cirurgia',
  nivelPuncao: 'nivel_puncao',
  tamanhoCpd: 'tamanho_cpd',
  marcaCpd: 'marca_cpd',
  marcaCpdPele: 'marca_cpd_pele',
  marcaCpdDentro: 'marca_cpd_dentro',
  dosesTransoperatorias: 'doses_transoperatorias',
  repiqueSrpa: 'repique_srpa',
  planoPosOperatorio: 'plano_pos_operatorio',
  dataRetirada: 'data_retirada',
  motivoRetirada: 'motivo_retirada',
  dataInsercao: 'data_insercao',
  createdBy: 'created_by',
  createdByName: 'created_by_name',
  updatedBy: 'updated_by',
  updatedByName: 'updated_by_name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

const FOLLOWUP_CAMEL_TO_SNAKE = {
  cateterId: 'cateter_id',
  diaPo: 'dia_po',
  planoDia: 'plano_dia',
  sitioInsercao: 'sitio_insercao',
  bromageScore: 'bromage_score',
  nivelSensitivo: 'nivel_sensitivo',
  marcaPeleAtual: 'marca_pele_atual',
  taxaInfusao: 'taxa_infusao',
  avaliadoPor: 'avaliado_por',
  avaliadoPorNome: 'avaliado_por_nome',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

const FOLLOWUP_SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(FOLLOWUP_CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj, mapping = CAMEL_TO_SNAKE) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = mapping[key] || key
    result[snakeKey] = value
  }
  return result
}

function toCamelCase(row, mapping = SNAKE_TO_CAMEL) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map((r) => toCamelCase(r, mapping))
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = mapping[key] || key
    result[camelKey] = value
  }
  return result
}

function followupToCamelCase(row) {
  return toCamelCase(row, FOLLOWUP_SNAKE_TO_CAMEL)
}

// ============================================================================
// HELPERS
// ============================================================================

function handleError(error, context) {
  console.error(`[SupabaseCateterPeridualService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// ============================================================================
// CATETER — LEITURA
// ============================================================================

async function fetchAll(options = {}) {
  const { status, limit = 200 } = options

  let query = supabase
    .from('cateteres_peridural')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchAll')
  return (data || []).map((r) => toCamelCase(r))
}

async function fetchById(id) {
  const { data, error } = await supabase
    .from('cateteres_peridural')
    .select('*')
    .eq('id', id)
    .single()

  if (error) handleError(error, 'fetchById')
  return toCamelCase(data)
}

async function fetchActive() {
  return fetchAll({ status: 'ativo' })
}

// ============================================================================
// CATETER — ESCRITA
// ============================================================================

async function create(cateterData, userInfo = {}) {
  // Ensure dates are strings, not Date objects
  const dataCirurgia = cateterData.dataCirurgia instanceof Date
    ? cateterData.dataCirurgia.toISOString().split('T')[0]
    : cateterData.dataCirurgia || null
  const dataInsercao = cateterData.dataInsercao instanceof Date
    ? cateterData.dataInsercao.toISOString()
    : cateterData.dataInsercao || new Date().toISOString()

  const row = {
    paciente: cateterData.paciente,
    hospital: cateterData.hospital || 'unimed',
    leito: cateterData.leito || null,
    cirurgia: cateterData.cirurgia || null,
    data_cirurgia: dataCirurgia,
    cirurgiao: cateterData.cirurgiao || null,
    anestesista: cateterData.anestesista || null,
    nivel_puncao: cateterData.nivelPuncao || null,
    tamanho_cpd: cateterData.tamanhoCpd || null,
    marca_cpd: cateterData.marcaCpd || null,
    marca_cpd_pele: cateterData.marcaCpdPele || null,
    marca_cpd_dentro: cateterData.marcaCpdDentro || null,
    doses_transoperatorias: cateterData.dosesTransoperatorias || null,
    repique_srpa: cateterData.repiqueSrpa || null,
    plano_pos_operatorio: cateterData.planoPosOperatorio || null,
    complicacoes: cateterData.complicacoes || null,
    status: 'ativo',
    data_insercao: dataInsercao,
    created_by: userInfo.userId || userInfo.uid || null,
    created_by_name: userInfo.userName || userInfo.displayName || 'Usuario',
  }

  console.log('[CateterService] create row:', JSON.stringify(row, null, 2))

  const { data, error } = await supabase
    .from('cateteres_peridural')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('[CateterService] create error:', error)
    handleError(error, 'create')
  }
  console.log('[CateterService] create success:', data?.id)
  return toCamelCase(data)
}

async function update(id, updates, userInfo = {}) {
  const snakeUpdates = toSnakeCase(updates)

  delete snakeUpdates.id
  delete snakeUpdates.created_at
  delete snakeUpdates.created_by
  delete snakeUpdates.created_by_name

  snakeUpdates.updated_at = new Date().toISOString()
  if (userInfo.userId || userInfo.uid) {
    snakeUpdates.updated_by = userInfo.userId || userInfo.uid
  }
  if (userInfo.userName || userInfo.displayName) {
    snakeUpdates.updated_by_name = userInfo.userName || userInfo.displayName
  }

  const { data, error } = await supabase
    .from('cateteres_peridural')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'update')
  return toCamelCase(data)
}

async function markAsRemoved(id, dataRetirada, motivoRetirada, userInfo = {}) {
  const now = new Date().toISOString()
  const updates = {
    status: 'retirado',
    data_retirada: dataRetirada || now,
    motivo_retirada: motivoRetirada || null,
    updated_at: now,
    updated_by: userInfo.userId || userInfo.uid || null,
    updated_by_name: userInfo.userName || userInfo.displayName || null,
  }

  console.log('[CateterService] markAsRemoved:', id, updates)

  const { data, error } = await supabase
    .from('cateteres_peridural')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[CateterService] markAsRemoved error:', error)
    handleError(error, 'markAsRemoved')
  }
  console.log('[CateterService] markAsRemoved success:', data)
  return toCamelCase(data)
}

// ============================================================================
// FOLLOW-UP — LEITURA
// ============================================================================

async function fetchFollowups(cateterId) {
  const { data, error } = await supabase
    .from('cateteres_peridural_followup')
    .select('*')
    .eq('cateter_id', cateterId)
    .order('dia_po', { ascending: true })

  if (error) handleError(error, 'fetchFollowups')
  return (data || []).map(followupToCamelCase)
}

// ============================================================================
// FOLLOW-UP — ESCRITA
// ============================================================================

async function createFollowup(followupData, userInfo = {}) {
  const row = {
    cateter_id: followupData.cateterId,
    dia_po: followupData.diaPo,
    plano_dia: followupData.planoDia || null,
    sitio_insercao: followupData.sitioInsercao || null,
    bromage_score: followupData.bromageScore != null ? followupData.bromageScore : null,
    nivel_sensitivo: followupData.nivelSensitivo || null,
    marca_pele_atual: followupData.marcaPeleAtual || null,
    taxa_infusao: followupData.taxaInfusao || null,
    complicacoes: followupData.complicacoes || null,
    observacoes: followupData.observacoes || null,
    avaliado_por: userInfo.userId || userInfo.uid || null,
    avaliado_por_nome: userInfo.userName || userInfo.displayName || 'Usuario',
  }

  const { data, error } = await supabase
    .from('cateteres_peridural_followup')
    .insert(row)
    .select()
    .single()

  if (error) handleError(error, 'createFollowup')
  return followupToCamelCase(data)
}

async function updateFollowup(id, updates) {
  const snakeUpdates = toSnakeCase(updates, FOLLOWUP_CAMEL_TO_SNAKE)

  delete snakeUpdates.id
  delete snakeUpdates.created_at

  snakeUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('cateteres_peridural_followup')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) handleError(error, 'updateFollowup')
  return followupToCamelCase(data)
}

// ============================================================================
// REAL-TIME
// ============================================================================

function subscribeToAll(callback) {
  const channel = supabase
    .channel('cateteres-peridural-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cateteres_peridural' },
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

const supabaseCateterPeridualService = {
  fetchAll,
  fetchById,
  fetchActive,
  create,
  update,
  markAsRemoved,
  fetchFollowups,
  createFollowup,
  updateFollowup,
  subscribeToAll,
  unsubscribe,
}

export { toCamelCase as cateterToCamelCase }

export default supabaseCateterPeridualService
