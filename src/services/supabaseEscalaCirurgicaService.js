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
  publicacaoTurnos: 'publicacao_turnos',
  // fila única do FDS (linha hospital='fds'): sem esta entrada o campo chega
  // como `fds_meta` e o modo fim de semana "não liga" em silêncio (pegadinha
  // recorrente — caso ultima_avaliacao_at/contaDuplicadaDe)
  fdsMeta: 'fds_meta',
  // escala_cirurgica_caso
  escalaId: 'escala_id',
  tempoEstimado: 'tempo_estimado',
  terminoPrevisto: 'termino_previsto',
  pacienteIniciais: 'paciente_iniciais',
  cirurgiaoDisplay: 'cirurgiao_display',
  anestesistaUserId: 'anestesista_user_id',
  residenteUserId: 'residente_user_id',
  isContinuacao: 'is_continuacao',
  semAnestesista: 'sem_anestesista',
  statusCirurgia: 'status_cirurgia',
  statusExtra: 'status_extra',
  statusAtualizadoPor: 'status_atualizado_por',
  statusAtualizadoEm: 'status_atualizado_em',
  statusPara: 'status_para',
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
// ⚠️ Coluna nova precisa entrar AQUI, no CAMEL_TO_SNAKE acima e na RPC
// rpc_salvar_escala_cirurgica (que enumera as colunas do INSERT) — faltando
// qualquer um dos três, o campo é descartado em silêncio ao publicar.
const CASO_FIELDS = [
  'sala', 'ordem', 'hora', 'tempoEstimado', 'terminoPrevisto', 'pacienteIniciais', 'idade', 'procedimento',
  'convenio', 'cirurgiao', 'cirurgiaoDisplay', 'anestesista', 'anestesistaUserId',
  'residente', 'residenteUserId', 'bloco',
  'isContinuacao', 'semAnestesista', 'tipo', 'turno',
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

  // O histórico de trocas é somente leitura e serve para manter o contexto no
  // card mesmo quando a troca foi desfeita e o override operacional foi limpo.
  // Falha nessa consulta não pode esconder a escala principal.
  let trocasHistorico = []
  try {
    const { data: eventos, error: eventosErr } = await supabase
      .from('escala_cirurgica_evento')
      .select('anestesista,detalhe,status_para,em,tipo')
      .eq('escala_id', header.id)
      .eq('tipo', 'troca')
      .order('em', { ascending: false })
      // janela: o consumo reduz ao último posicao_assumida por chave; sem teto,
      // um dia agitado (republicações geram rajadas) crescia sem limite (D9)
      .limit(60)
    if (!eventosErr) trocasHistorico = (eventos || []).map(toCamelCase)
  } catch { /* histórico é complementar */ }

  return { ...toCamelCase(header), casos: (casos || []).map(toCamelCase), trocasHistorico }
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Locais conhecidos do hospital p/ o editor de linha — a lista "APRENDE":
 * união das SALAS dos casos + locais ajustados (linha_overrides.local) das
 * escalas dos últimos N dias. Um local novo digitado em "Outro" passa a ser
 * oferecido a todos assim que o override é salvo (sem tabela nova).
 */
async function fetchLocaisHospital(hospital, dias = 60) {
  const desde = new Date(Date.now() - dias * 86400000)
  const off = desde.getTimezoneOffset() * 60000
  const desdeISO = new Date(desde.getTime() - off).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('escala_cirurgica')
    .select('linha_overrides, escala_cirurgica_caso(sala)')
    .eq('hospital', hospital)
    .gte('data', desdeISO)
  if (error) handleError(error, 'fetchLocaisHospital')
  const locais = new Set()
  for (const row of data || []) {
    for (const c of row.escala_cirurgica_caso || []) {
      const s = String(c.sala || '').trim()
      if (s) locais.add(s)
    }
    for (const ov of Object.values(row.linha_overrides || {})) {
      const local = typeof ov === 'string' ? ov : ov?.local
      if (local && String(local).trim()) locais.add(String(local).trim())
    }
  }
  return [...locais]
}

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

/**
 * Publica/substitui somente um turno. A RPC trava o cabeçalho diário e faz o
 * replace + reset operacional do turno em uma transação; o outro turno não é
 * apagado nem tem suas liberações/overrides alterados.
 */
async function salvarEscalaTurno({ data, hospital, turno, casos = [], ordemLiberacao = [], ajudaExterna = [], sourceImagePath, status = 'publicada', fdsMeta }, userInfo = {}) {
  if (turno !== 'matutino' && turno !== 'vespertino') {
    throw new Error('salvarEscalaTurno: turno inválido')
  }
  const p_header = {
    data, hospital, status,
    ordem_liberacao: ordemLiberacao,
    ajuda_externa: ajudaExterna,
    source_image_path: sourceImagePath ?? null,
    // payload do documento de FDS — só a linha hospital='fds' envia; a RPC
    // preserva o valor atual quando o campo não vem (republicação de 1 turno)
    ...(fdsMeta !== undefined ? { fds_meta: fdsMeta } : {}),
    ...(userInfo.userName ? { published_by_name: userInfo.userName } : {}),
  }
  // O turno da operação é a fonte de verdade; não aceitar um turno divergente
  // vindo de uma linha legada/estado de UI.
  const p_casos = casos.map((c, i) => casoToRow({ ...c, ordem: i, turno }, null))
  const { data: result, error } = await supabase.rpc('rpc_publicar_escala_turno', {
    p_data: data, p_hospital: hospital, p_turno: turno, p_header, p_casos,
  })
  if (error) handleError(error, 'salvarEscalaTurno:rpc')
  const { header, casos: casoRows } = result || {}
  return { ...toCamelCase(header), casos: (casoRows || []).map(toCamelCase) }
}

/**
 * Zera as liberações do DIA (marcas de liberado + overrides de linha). Regra do
 * dono 23/07: a escala recém-postada é a VÁLIDA — publicar um turno novo ignora
 * as liberações do turno anterior e começa do zero.
 */
async function resetLiberacoesDia(escalaId) {
  const { error } = await supabase
    .from('escala_cirurgica')
    .update({ liberacoes: {}, linha_overrides: {} })
    .eq('id', escalaId)
  if (error) handleError(error, 'resetLiberacoesDia')
}

/** Atualiza a ordem de liberação (rodapé reordenado pelo plantonista). */
async function updateOrdemLiberacao(escalaId, ordemLiberacao) {
  const { error } = await supabase
    .from('escala_cirurgica')
    .update({ ordem_liberacao: ordemLiberacao })
    .eq('id', escalaId)
  if (error) handleError(error, 'updateOrdemLiberacao')
}

/** Atualiza a ajuda externa (anestesistas de outro hospital, por turno). */
async function updateAjudaExterna(escalaId, ajudaExterna) {
  const { error } = await supabase
    .from('escala_cirurgica')
    .update({ ajuda_externa: ajudaExterna })
    .eq('id', escalaId)
  if (error) handleError(error, 'updateAjudaExterna')
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

/**
 * Troca o responsável de casos ESPECÍFICOS (ids) — NUNCA a sala inteira às
 * cegas: o update sala-wide achatou o IOSC (multi-anestesista) p/ uma pessoa
 * em 23/07. O chamador decide os alvos via alvosTrocaResponsavel (linhas com
 * anestesista próprio ficam de fora). Substitui o sistema de trocas.
 */
async function updateAnestesistaCasos(casoIds = [], { uid, apelido, dupla = false }) {
  const ids = (casoIds || []).filter(Boolean)
  if (!ids.length) return
  // DUPLA na MESMA cirurgia (dono 11/08): duas pessoas não cabem num uid — o
  // texto "A + B" É o dado (a Completa mostra os dois no cabeçalho e a fila
  // conta presença dos dois). uid null aqui NÃO é "sem anestesista": sem esta
  // ramificação o service gravaria "?" e a cirurgia cairia no alerta.
  // uid null (sem dupla) = deixar o caso SEM anestesista de propósito (vira "?"
  // e volta ao alerta das Liberações — pedido do dono 26/07). Com uid, o caminho
  // normal: sem_anestesista=false tira o caso do alerta assim que ganha dono (24/07).
  const patch = dupla
    ? { anestesista: apelido, anestesista_user_id: null, sem_anestesista: false }
    : uid
      ? { anestesista: apelido, anestesista_user_id: uid, sem_anestesista: false }
      : { anestesista: '?', anestesista_user_id: null, sem_anestesista: true }
  const { error } = await supabase
    .from('escala_cirurgica_caso')
    .update(patch)
    .in('id', ids)
  if (error) handleError(error, 'updateAnestesistaCasos')
}

/**
 * Restaura o snapshot EXATO de anestesista por caso — caminho de ROLLBACK da
 * troca. Nunca deriva do uid: dono sem vínculo (uid null) viraria '?' pelo
 * updateAnestesistaCasos e o rollback apagaria o anestesista em vez de
 * restaurá-lo (defeito 07/08). Loop de updates individuais: é caminho de erro
 * (raro) e cada caso pode ter valores diferentes.
 */
async function restaurarAnestesistaCasos(snapshots = []) {
  for (const s of snapshots || []) {
    if (!s?.id) continue
    const { error } = await supabase
      .from('escala_cirurgica_caso')
      .update({
        anestesista: s.anestesista ?? null,
        anestesista_user_id: s.anestesistaUserId ?? null,
        sem_anestesista: !!s.semAnestesista,
      })
      .eq('id', s.id)
    if (error) handleError(error, 'restaurarAnestesistaCasos')
  }
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
 * Status atual de casos por id (batch) — usado pelo módulo Cirurgias
 * Particulares p/ alertar lançamento cujo caso foi suspenso depois.
 * Ids ausentes (escala republicada faz DELETE+reinsert) simplesmente não
 * voltam — o chamador trata como "sem informação", nunca como erro.
 */
async function fetchCasosStatus(ids = []) {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('escala_cirurgica_caso')
    .select('id, status_cirurgia, status_extra')
    .in('id', ids)
  if (error) handleError(error, 'fetchCasosStatus')
  return (data || []).map(toCamelCase)
}

// ============================================================================
// PLANTÃO NOTURNO — onde o P4 (coringa) está escalado no dia
// ============================================================================

/**
 * Hospital marcado do P4 na data ('unimed'|'hro'|'materno') ou null quando
 * ninguém marcou — null = o P4 aparece nos TRÊS hospitais na fase noturna.
 * Falha de rede/RLS NÃO derruba a aba: cai em null (comportamento padrão).
 */
async function fetchP4Hospital(data) {
  const { data: row, error } = await supabase
    .from('escala_plantao_p4_diario')
    .select('hospital')
    .eq('data', data)
    .maybeSingle()
  if (error) handleError(error, 'fetchP4Hospital')
  return row?.hospital || null
}

/**
 * Marca em qual hospital o P4 está na data (upsert por data — 1 linha por dia).
 * `marcado_por`/`marcado_em` são gravados SERVER-SIDE pelo trigger (firebase_uid);
 * daqui vai só o nome de exibição de quem marcou.
 */
async function setP4Hospital(data, hospital, { userName = null } = {}) {
  const { error } = await supabase
    .from('escala_plantao_p4_diario')
    .upsert({ data, hospital, marcado_por_nome: userName }, { onConflict: 'data' })
  if (error) handleError(error, 'setP4Hospital')
}

/**
 * Extrai a escala estruturada de uma imagem via Edge Function (Claude Vision).
 * Retorna { casos: [...], ordemLiberacao: [...] }. Paciente vem só por iniciais.
 * Lança em caso de falha (a UI cai no preenchimento manual).
 *
 * modo 'fds' (2026-08-15): o upload é o documento "ESCALA DE FINAL DE SEMANA"
 * e a resposta vira { dias: [...], ignorados: [...] } — refSabado/refDomingo
 * dão o ano às datas do título ("SÁBADO – 15 DE AGOSTO" vem sem ano).
 */
async function parseEscalaImagem({ imageBase64, mimeType, hospital, modo, refSabado, refDomingo }) {
  const { data, error } = await supabase.functions.invoke('parse-escala-cirurgica', {
    body: {
      imageBase64, mimeType, hospital,
      ...(modo ? { modo } : {}),
      ...(refSabado ? { refSabado } : {}),
      ...(refDomingo ? { refDomingo } : {}),
    },
  })
  if (error) handleError(error, 'parseEscalaImagem')
  return data || (modo === 'fds' ? { dias: [], ignorados: [] } : { casos: [], ordemLiberacao: [] })
}


// ============================================================================
// AVISO DO PLANTONISTA (dono 2026-08-17)
// ============================================================================
// Recado que o plantonista deixa na aba Liberações. Vive na TELA (realtime) e
// some para cada pessoa que confirma — não é notificação: a escala não manda
// mensagem a ninguém desde 30/07.
//
// A autoria e o confirmante são gravados por TRIGGER no banco (firebase_uid()),
// então o que se manda daqui é só o texto; nome/uid do cliente entram apenas
// como fallback quando o perfil ainda não existe no `profiles`.

/** Avisos do turno + quem já confirmou cada um (mais recente primeiro). */
async function fetchAvisos(escalaId, turno) {
  if (!escalaId || String(escalaId).startsWith('demo-')) return []
  const { data, error } = await supabase
    .from('escala_cirurgica_aviso')
    // `*` + embed: select explícito de coluna que não existe volta lista VAZIA
    // em silêncio (lição registrada no projeto)
    .select('*, confirmacoes:escala_cirurgica_aviso_confirmacao(user_id)')
    .eq('escala_id', escalaId)
    .eq('turno', turno)
    .order('criado_em', { ascending: false })
  if (error) handleError(error, 'fetchAvisos')
  return (data || []).map((row) => ({
    id: row.id,
    texto: row.texto,
    autorUserId: row.autor_user_id,
    autorNome: row.autor_nome,
    criadoEm: row.criado_em,
    confirmadoPor: (row.confirmacoes || []).map((c) => c.user_id).filter(Boolean),
  }))
}

/** Publica um recado. Autor e horário vêm do trigger, nunca do cliente. */
async function criarAviso(escalaId, turno, texto, { userName } = {}) {
  const { data, error } = await supabase
    .from('escala_cirurgica_aviso')
    .insert({ escala_id: escalaId, turno, texto: String(texto || '').trim(), autor_nome: userName || null })
    .select('id')
    .single()
  if (error) handleError(error, 'criarAviso')
  return data?.id || null
}

/** Apaga um recado (o plantonista tira o que não vale mais — dono 17/08). */
async function excluirAviso(avisoId) {
  const { error } = await supabase.from('escala_cirurgica_aviso').delete().eq('id', avisoId)
  if (error) handleError(error, 'excluirAviso')
}

/** Confirma por SI (a RLS amarra a linha ao uid do JWT). Repetir é no-op. */
async function confirmarAviso(avisoId, { userId, userName } = {}) {
  const { error } = await supabase
    .from('escala_cirurgica_aviso_confirmacao')
    .upsert({ aviso_id: avisoId, user_id: userId, user_nome: userName || null }, { onConflict: 'aviso_id,user_id' })
  if (error) handleError(error, 'confirmarAviso')
}

export default {
  fetchEscala,
  fetchAvisos,
  criarAviso,
  confirmarAviso,
  excluirAviso,
  fetchLocaisHospital,
  salvarEscala,
  salvarEscalaTurno,
  resetLiberacoesDia,
  updateOrdemLiberacao,
  updateAjudaExterna,
  patchLiberacao,
  patchLinhaOverride,
  updateStatusCirurgia,
  updateAnestesistaCasos,
  addCaso,
  updateCaso,
  removeEscala,
  fetchCasosStatus,
  fetchP4Hospital,
  setP4Hospital,
  parseEscalaImagem,
  restaurarAnestesistaCasos,
}
