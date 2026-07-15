/**
 * Supabase Escala Cirúrgica Service — escala do dia por hospital + casos.
 *
 * CRUD da escala cirúrgica diária (cabeçalho `escala_cirurgica` + casos
 * `escala_cirurgica_caso`). Converte camelCase <-> snake_case. Segue o mesmo
 * padrão de supabaseComunicadosService.js.
 *
 * Audit: published_by/created_by recebem o userId REAL (nunca 'system'/'admin').
 * LGPD: paciente só por iniciais (paciente_iniciais).
 */
import { supabase } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — camelCase <-> snake_case
// ============================================================================
const CAMEL_TO_SNAKE = {
  // escala_cirurgica
  ordemLiberacao: 'ordem_liberacao',
  ajudaExterna: 'ajuda_externa',
  linhaOverrides: 'linha_overrides',
  sourceImagePath: 'source_image_path',
  publishedAt: 'published_at',
  publishedBy: 'published_by',
  publishedByName: 'published_by_name',
  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // escala_cirurgica_caso
  escalaId: 'escala_id',
  tempoEstimado: 'tempo_estimado',
  pacienteIniciais: 'paciente_iniciais',
  cirurgiaoDisplay: 'cirurgiao_display',
  anestesistaUserId: 'anestesista_user_id',
  isContinuacao: 'is_continuacao',
  semAnestesista: 'sem_anestesista',
  statusCirurgia: 'status_cirurgia',
  statusAtualizadoPor: 'status_atualizado_por',
  statusAtualizadoEm: 'status_atualizado_em',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[CAMEL_TO_SNAKE[key] || key] = value
  }
  return result
}

function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamelCase)
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    result[SNAKE_TO_CAMEL[key] || key] = value
  }
  return result
}

function handleError(error, context) {
  console.error(`[SupabaseEscalaCirurgicaService] ${context}:`, error)
  throw new Error(`${context}: ${error.message}`)
}

// Campos aceitos num caso (evita enviar lixo do front, ex. ids client-side).
const CASO_FIELDS = [
  'sala', 'ordem', 'hora', 'tempoEstimado', 'pacienteIniciais', 'idade', 'procedimento',
  'convenio', 'cirurgiao', 'cirurgiaoDisplay', 'anestesista', 'anestesistaUserId', 'bloco',
  'isContinuacao', 'semAnestesista', 'tipo',
]

function casoToRow(caso, escalaId) {
  const clean = {}
  for (const f of CASO_FIELDS) if (caso[f] !== undefined) clean[f] = caso[f]
  return { ...toSnakeCase(clean), escala_id: escalaId }
}

// ============================================================================
// LEITURA
// ============================================================================

/** Busca a escala (cabeçalho + casos ordenados) de um hospital numa data. */
async function fetchEscala(data, hospital) {
  const { data: header, error } = await supabase
    .from('escala_cirurgica')
    .select('*')
    .eq('data', data)
    .eq('hospital', hospital)
    .maybeSingle()

  if (error) handleError(error, 'fetchEscala:header')
  if (!header) return null

  const { data: casos, error: casosErr } = await supabase
    .from('escala_cirurgica_caso')
    .select('*')
    .eq('escala_id', header.id)
    .order('sala', { ascending: true })
    .order('ordem', { ascending: true })

  if (casosErr) handleError(casosErr, 'fetchEscala:casos')

  return { ...toCamelCase(header), casos: (casos || []).map(toCamelCase) }
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Cria/atualiza o cabeçalho da escala (upsert por data+hospital) e SUBSTITUI
 * todos os casos. Usado pela publicação/edição vinda da tela de conferência.
 */
async function salvarEscala({ data, hospital, casos = [], ordemLiberacao = [], ajudaExterna = [], sourceImagePath, status = 'publicada' }, userInfo = {}) {
  const { userName = null } = userInfo

  // Header + casos gravados numa TRANSAÇÃO ÚNICA (RPC) — sem escala vazia se o
  // INSERT falhar e sem flash "Sem escala" no realtime durante o replace.
  // Audit é server-side: a RPC grava created_by/published_by = firebase_uid();
  // daqui vai só o display name como fallback do nome de quem publicou.
  const p_header = {
    data,
    hospital,
    status,
    ordem_liberacao: ordemLiberacao,
    ajuda_externa: ajudaExterna,
    source_image_path: sourceImagePath ?? null,
    ...(status === 'publicada' && userName ? { published_by_name: userName } : {}),
  }
  const p_casos = casos.map((c, i) => casoToRow({ ordem: i, ...c }, null))

  const { data: rpcResult, error } = await supabase.rpc('rpc_salvar_escala_cirurgica', { p_header, p_casos })
  if (error) handleError(error, 'salvarEscala:rpc')

  const { header, casos: casosRows } = rpcResult || {}
  return { ...toCamelCase(header), casos: (casosRows || []).map(toCamelCase) }
}

/** Atualiza a ordem de liberação (rodapé reordenado pelo plantonista). */
async function updateOrdemLiberacao(escalaId, ordemLiberacao) {
  const { error } = await supabase
    .from('escala_cirurgica')
    .update({ ordem_liberacao: ordemLiberacao })
    .eq('id', escalaId)
  if (error) handleError(error, 'updateOrdemLiberacao')
}

/**
 * Marca/desmarca UMA liberação — merge server-side por chave (jsonb_set na RPC),
 * para dois plantonistas simultâneos não se sobrescreverem (fim do last-write-wins).
 * valor = { liberadoEm, por } para marcar; null para desfazer.
 */
async function patchLiberacao(escalaId, chave, valor) {
  const { error } = await supabase.rpc('rpc_escala_patch_liberacao', {
    p_escala_id: escalaId, p_campo: 'liberacoes', p_chave: chave, p_valor: valor ?? null,
  })
  if (error) handleError(error, 'patchLiberacao')
}

/**
 * Grava/limpa o override de UMA linha da coluna ({ local?, cirurgioes?, por, em })
 * — mesmo merge server-side por chave. valor null remove o override.
 */
async function patchLinhaOverride(escalaId, chave, valor) {
  const { error } = await supabase.rpc('rpc_escala_patch_liberacao', {
    p_escala_id: escalaId, p_campo: 'linha_overrides', p_chave: chave, p_valor: valor ?? null,
  })
  if (error) handleError(error, 'patchLinhaOverride')
}

/**
 * Atualiza o STATUS da cirurgia (agendada/iniciada/terminada) — RPC com audit
 * carimbado server-side (status_atualizado_por/em = firebase_uid()/now()).
 */
async function updateStatusCirurgia(casoId, status) {
  const { error } = await supabase.rpc('rpc_escala_status_cirurgia', {
    p_caso_id: casoId, p_status: status,
  })
  if (error) handleError(error, 'updateStatusCirurgia')
}

/**
 * Acrescenta um caso à escala publicada (urgência/encaixe/fora do mapa).
 * Integra como qualquer outro: board re-agrupa e a liberação re-deriva.
 */
async function addCaso(escalaId, caso) {
  const { data, error } = await supabase
    .from('escala_cirurgica_caso')
    .insert(casoToRow(caso, escalaId))
    .select('*')
    .single()
  if (error) handleError(error, 'addCaso')
  return toCamelCase(data)
}

/** Edita um caso isolado (ajuste pontual de anestesista/cirurgião). */
async function updateCaso(casoId, updates) {
  const clean = {}
  for (const f of CASO_FIELDS) if (updates[f] !== undefined) clean[f] = updates[f]
  const { error } = await supabase
    .from('escala_cirurgica_caso')
    .update(toSnakeCase(clean))
    .eq('id', casoId)
  if (error) handleError(error, 'updateCaso')
}

async function removeEscala(escalaId) {
  const { error } = await supabase.from('escala_cirurgica').delete().eq('id', escalaId)
  if (error) handleError(error, 'removeEscala')
}

/**
 * Extrai a escala estruturada de uma imagem via Edge Function (Claude Vision).
 * Retorna { casos: [...], ordemLiberacao: [...] }. Paciente vem só por iniciais.
 * Lança em caso de falha (a UI cai no preenchimento manual).
 */
async function parseEscalaImagem({ imageBase64, mimeType, hospital }) {
  const { data, error } = await supabase.functions.invoke('parse-escala-cirurgica', {
    body: { imageBase64, mimeType, hospital },
  })
  if (error) handleError(error, 'parseEscalaImagem')
  return data || { casos: [], ordemLiberacao: [] }
}

export default {
  fetchEscala,
  salvarEscala,
  updateOrdemLiberacao,
  patchLiberacao,
  patchLinhaOverride,
  updateStatusCirurgia,
  addCaso,
  updateCaso,
  removeEscala,
  parseEscalaImagem,
}
