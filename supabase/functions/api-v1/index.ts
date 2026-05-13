// =============================================================================
// supabase/functions/api-v1/index.ts — Sprint 14c / O2-5 + Sprint 15b (API v2)
//                                     + Sprint 16 (scopes granular A2)
//
// API pública read-only para integração externa. Monolito com router interno
// por URL.pathname (segue precedente do projeto: edges autocontidas).
//
// Rotas:
//   GET /v1/docs                      → lista paginada de documentos (200)
//   GET /v1/docs/:id                  → documento único whitelisted (200/404)
//   GET /v1/docs/:id/changelog        → histórico paginado do doc (200/404)
//   GET /v1/planos-acao               → Sprint 15b: lista paginada planos PDCA (200)
//   GET /v1/comunicados               → Sprint 15b: lista paginada comunicados (200)
//   *                                 → 404 { error: 'not_found' }
//
// Auth:
//   Header: Authorization: Bearer <token-raw>
//   Token raw → SHA-256 hex (Deno crypto.subtle).
//   Lookup direto em public.api_tokens (revoked_at IS NULL).
//   Sprint 16: lê scopes text[] da linha; fallback para os 3 legacy (back-compat
//   com tokens criados com scope='read' antes da migration 20260513120000).
//   Side-effect last_used_at + usage_count continua via RPC is_valid_api_token.
//   Falta header OU token inválido → 401 { error: 'invalid_token' }.
//
// Scopes (Sprint 16):
//   ENDPOINT_SCOPES = { '/v1/docs': 'read:docs', '/v1/planos-acao': 'read:planos-acao',
//                       '/v1/comunicados': 'read:comunicados' }
//   Match por prefix — '/v1/docs/abc/changelog' herda 'read:docs'.
//   Se auth.scopes não contém o required → 403 { error:'forbidden', required_scope }.
//
// Rate limit:
//   Sliding window 50 req/min/IP em public.documento_api_rate_limit
//   (endpoint='api-v1'). IP: x-forwarded-for[0] → cf-connecting-ip → 'unknown'.
//   Excedeu → 429 { error: 'rate_limit_exceeded' } + Retry-After header.
//   Em 200 responses inclui X-RateLimit-Limit/Remaining/Reset.
//   Gate aplicado UMA VEZ antes do router → cobre TODAS as rotas (/docs,
//   /docs/:id, /docs/:id/changelog). Confirmado em Sprint 14c B3.
//   NOTA: COUNT+INSERT não-atômico (best-effort). Aceitável para 50/min/IP.
//
// PII:
//   Dupla camada — (a) view vw_api_documentos já é whitelist, (b) stripPii()
//   no edge confirma whitelist em JS antes de serializar (defesa em profundidade).
//   Endpoint /changelog não precisa stripPii (view já exclui user_id/email/etc;
//   só expõe id/documento_id/versao/acao/created_at — todos não-PII).
//
// Env vars necessárias (todas providas pela Supabase em deploy):
//   SUPABASE_URL                — URL do projeto
//   SUPABASE_SERVICE_ROLE_KEY   — service-role (chama RPC e lê views)
//
// Deploy:
//   npx supabase functions deploy api-v1 --no-verify-jwt --project-ref <REF>
//
// Smoke:
//   node scripts/smoke-api-v1.mjs
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// ──────────────────────────────────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-forwarded-for, cf-connecting-ip',
}

// Rate limit: 50 req/min/IP, sliding window 60s
const RL_WINDOW_SECONDS = 60
const RL_LIMIT = 50
const RL_ENDPOINT = 'api-v1'

// Pagination
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    // "client, proxy1, proxy2" → primeiro é o cliente real
    return xff.split(',')[0].trim() || 'unknown'
  }
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  return 'unknown'
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hashBuf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const raw = m[1].trim()
  return raw.length > 0 ? raw : null
}

// Whitelist explícita JS-side. Defesa em profundidade — a view já garante
// estas colunas, mas confiar 100% na view é frágil (qualquer ALTER VIEW
// futuro poderia adicionar coluna). Este filtro é o contrato definitivo.
const ALLOWED_FIELDS = [
  'id',
  'titulo',
  'tipo',
  'categoria',
  'status',
  'versao_atual',
  'rop_area',
  'qmentum_weight',
  'created_at',
  'updated_at',
  'proxima_revisao',
] as const

type AllowedField = (typeof ALLOWED_FIELDS)[number]

interface DocRow {
  [key: string]: unknown
}

function stripPii(row: DocRow): Record<AllowedField, unknown> {
  const out = {} as Record<AllowedField, unknown>
  for (const k of ALLOWED_FIELDS) {
    out[k] = row[k] ?? null
  }
  return out
}

// Tipos exportados para documentar o contrato público (apenas docs/IDE — Deno
// edge funcs não consumidas externamente como módulo, mas o tipo serve como
// referência canônica do shape devolvido por /v1/docs e /v1/docs/:id).
export type ApiDoc = Record<AllowedField, unknown>

// Shape devolvido por /v1/docs/:id/changelog. Reflete colunas da view
// public.vw_api_documentos_changelog (migration 20260512100000).
export interface ApiChangelogEntry {
  id: string
  documento_id: string
  versao: number | null
  acao: string
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 15b — API v2 whitelists (planos_acao + comunicados)
//
// Defesa em profundidade: as views vw_api_planos_acao e vw_api_comunicados
// JÁ excluem PII (whitelist no SQL). Estes arrays JS são a 2ª camada — se
// um ALTER VIEW futuro adicionar coluna sem revisão, ela NÃO vaza.
// ──────────────────────────────────────────────────────────────────────────
const ALLOWED_FIELDS_PLANOS_ACAO = [
  'id',
  'titulo',
  'tipo_origem',
  'status',
  'fase_pdca',
  'prazo',
  'prioridade',
  'eficacia',
  'tags',
  'created_at',
  'updated_at',
] as const

type AllowedPlanoAcaoField = (typeof ALLOWED_FIELDS_PLANOS_ACAO)[number]

const ALLOWED_FIELDS_COMUNICADOS = [
  'id',
  'tipo',
  'titulo',
  'status',
  'leitura_obrigatoria',
  'rop_area',
  'rop_relacionada',
  'link',
  'data_evento',
  'prazo_confirmacao',
  'data_validade',
  'created_at',
  'updated_at',
] as const

type AllowedComunicadoField = (typeof ALLOWED_FIELDS_COMUNICADOS)[number]

function stripPiiPlanoAcao(row: DocRow): Record<AllowedPlanoAcaoField, unknown> {
  const out = {} as Record<AllowedPlanoAcaoField, unknown>
  for (const k of ALLOWED_FIELDS_PLANOS_ACAO) {
    out[k] = row[k] ?? null
  }
  return out
}

function stripPiiComunicado(row: DocRow): Record<AllowedComunicadoField, unknown> {
  const out = {} as Record<AllowedComunicadoField, unknown>
  for (const k of ALLOWED_FIELDS_COMUNICADOS) {
    out[k] = row[k] ?? null
  }
  return out
}

// Tipos exportados para documentar o contrato público (Sprint 15b).
export type ApiPlanoAcao = {
  id: string
  titulo: string | null
  tipo_origem: string | null
  status: string | null
  fase_pdca: string | null
  prazo: string | null
  prioridade: string | null
  eficacia: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export type ApiComunicado = {
  id: string
  tipo: string | null
  titulo: string | null
  status: string | null
  leitura_obrigatoria: boolean | null
  rop_area: string | null
  rop_relacionada: string[] | null
  link: string | null
  data_evento: string | null
  prazo_confirmacao: string | null
  data_validade: string | null
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Scopes (Sprint 16)
//
// Whitelist canônica — espelha CHECK constraint api_tokens_scopes_subset_check
// e VALID_SCOPES no service JS (src/services/supabaseApiTokensService.js).
// Mudar aqui exige mudar a migration e o service.
// ──────────────────────────────────────────────────────────────────────────
const LEGACY_ALL_SCOPES = [
  'read:docs',
  'read:planos-acao',
  'read:comunicados',
] as const

// Map endpoint-prefix → { read, write } scope obrigatório. Sprint 19 separa
// por método HTTP: GET → read:*, POST/PUT/DELETE → write:*. Match por prefix
// garante que sub-rotas como /v1/docs/:id e /v1/docs/:id/changelog herdem.
const ENDPOINT_SCOPES: Record<string, { read: string; write: string }> = {
  '/v1/docs': { read: 'read:docs', write: 'write:docs' },
  '/v1/planos-acao': { read: 'read:planos-acao', write: 'write:planos-acao' },
  '/v1/comunicados': { read: 'read:comunicados', write: 'write:comunicados' },
}

/**
 * Resolve qual scope o endpoint pedido exige. Sprint 19: depende do método.
 * GET → read:*, POST/PUT/DELETE → write:*.
 * Retorna null para paths que não casam (router devolverá 404 depois).
 */
function requiredScopeFor(method: string, pathname: string): string | null {
  for (const [prefix, scopes] of Object.entries(ENDPOINT_SCOPES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return method === 'GET' ? scopes.read : scopes.write
    }
  }
  return null
}

// ──────────────────────────────────────────────────────────────────────────
// Auth middleware
//
// Sprint 16: além de validar o token, devolve o array de scopes autorizados
// para o caller (Main) checar contra requiredScopeFor(pathname).
// Back-compat: linhas com scopes NULL/vazio (pré-migration ou pré-backfill)
// recebem os 3 LEGACY_ALL_SCOPES (semantica de scope='read').
// ──────────────────────────────────────────────────────────────────────────
async function authenticate(
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<
  | { ok: true; scopes: string[]; token_id: string }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const raw = extractBearer(req)
  if (!raw) {
    return {
      ok: false,
      status: 401,
      body: { error: 'invalid_token', message: 'Authorization Bearer header required' },
    }
  }

  let hash: string
  try {
    hash = await sha256Hex(raw)
  } catch (err) {
    console.error('api-v1: sha256 error', err)
    return { ok: false, status: 401, body: { error: 'invalid_token' } }
  }

  // Lookup direto na tabela — precisa do `scopes` array, que a RPC original
  // (boolean) não devolve. Filtro ativo: revoked_at IS NULL.
  const { data: row, error: lookupErr } = await supabase
    .from('api_tokens')
    .select('id, scopes, revoked_at')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .maybeSingle()

  if (lookupErr) {
    console.error('api-v1: api_tokens lookup error', lookupErr.message)
    return { ok: false, status: 401, body: { error: 'invalid_token' } }
  }
  if (!row) {
    return { ok: false, status: 401, body: { error: 'invalid_token' } }
  }

  // Side-effect (last_used_at + usage_count) continua via RPC SECURITY DEFINER.
  // Erro aqui NÃO derruba a request — métricas são best-effort.
  const { error: rpcErr } = await supabase.rpc('is_valid_api_token', {
    p_token_hash: hash,
  })
  if (rpcErr) {
    console.error('api-v1: is_valid_api_token RPC error (non-fatal)', rpcErr.message)
  }

  // Fallback de scopes: NULL ou array vazio → assume 3 legacy (back-compat).
  const scopes: string[] =
    Array.isArray(row.scopes) && row.scopes.length > 0
      ? (row.scopes as string[])
      : [...LEGACY_ALL_SCOPES]

  return { ok: true, scopes, token_id: row.id as string }
}

// ──────────────────────────────────────────────────────────────────────────
// Rate limit (sliding window via documento_api_rate_limit)
// ──────────────────────────────────────────────────────────────────────────
async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ip: string,
): Promise<
  | { allowed: true; remaining: number; resetSeconds: number }
  | { allowed: false; retryAfter: number; resetSeconds: number }
> {
  const windowStart = new Date(Date.now() - RL_WINDOW_SECONDS * 1000).toISOString()

  // COUNT em janela
  const { count, error: countErr } = await supabase
    .from('documento_api_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('endpoint', RL_ENDPOINT)
    .gte('requested_at', windowStart)

  if (countErr) {
    // Se a tabela existe mas algo deu errado, falha aberto p/ não bloquear API.
    // (RLS está enabled mas service_role bypassa; falha aqui é improvável.)
    console.error('api-v1: rate-limit COUNT error', countErr.message)
    return { allowed: true, remaining: RL_LIMIT, resetSeconds: RL_WINDOW_SECONDS }
  }

  const current = count ?? 0

  if (current >= RL_LIMIT) {
    return {
      allowed: false,
      retryAfter: RL_WINDOW_SECONDS,
      resetSeconds: RL_WINDOW_SECONDS,
    }
  }

  // INSERT registro desta request
  const { error: insErr } = await supabase
    .from('documento_api_rate_limit')
    .insert({ ip, endpoint: RL_ENDPOINT })

  if (insErr) {
    console.error('api-v1: rate-limit INSERT error', insErr.message)
    // Falha aberto — log já feito; não interrompe request.
  }

  const remaining = Math.max(0, RL_LIMIT - current - 1)
  return { allowed: true, remaining, resetSeconds: RL_WINDOW_SECONDS }
}

function rateHeaders(remaining: number, resetSeconds: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(RL_LIMIT),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetSeconds),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Handler: GET /v1/docs
// ──────────────────────────────────────────────────────────────────────────
async function handleListDocs(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  url: URL,
  rlHeaders: Record<string, string>,
): Promise<Response> {
  const params = url.searchParams

  // Parsing seguro de paginação
  let limit = Number.parseInt(params.get('limit') ?? '', 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  let offset = Number.parseInt(params.get('offset') ?? '', 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  // Construção da query — selecionamos apenas as colunas da whitelist
  let query = supabase
    .from('vw_api_documentos')
    .select(ALLOWED_FIELDS.join(','), { count: 'exact' })

  // Filtros simples (eq)
  const status = params.get('status')
  if (status) query = query.eq('status', status)

  const tipo = params.get('tipo')
  if (tipo) query = query.eq('tipo', tipo)

  const ropArea = params.get('rop_area')
  if (ropArea) query = query.eq('rop_area', ropArea)

  // Full-text search via ILIKE no titulo (simples; FTS real fica para v2)
  const q = params.get('q')
  if (q && q.trim().length > 0) {
    const term = q.trim().replace(/[%_]/g, '\\$&') // escape LIKE wildcards
    query = query.ilike('titulo', `%${term}%`)
  }

  // Ordering: mais recentes primeiro (determinístico para paginação)
  query = query.order('updated_at', { ascending: false, nullsFirst: false })
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    console.error('api-v1: list docs query error', error.message)
    return jsonResponse(500, { error: 'internal_error' }, rlHeaders)
  }

  // stripPii — defesa em profundidade (mesmo que a view garanta).
  const rows = Array.isArray(data) ? data : []
  const sanitized = rows.map((row) => stripPii(row as DocRow))

  return jsonResponse(
    200,
    {
      data: sanitized,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    },
    rlHeaders,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Handler: GET /v1/docs/:id
//
// Retorna documento único whitelisted ou 404. NÃO envolve em array — shape
// é { data: <row> } (contraste com /v1/docs que retorna { data: [..] }).
// ──────────────────────────────────────────────────────────────────────────
// Validação leve do `id` que vem do path. `documentos.id` é TEXT (não uuid),
// então o shape real é livre — IDs reais em prod têm prefixo `doc-` (ex.:
// `doc-b06e79ee-8b3a-7a72-ca7b-03a03b9d5364`). Defendemos contra strings
// arbitrárias (caracteres especiais, espaços) que poluiriam logs sem servir
// para nada. NÃO é validação de segurança — PostgREST parametriza a query.
const ID_RE = /^[A-Za-z0-9_-]{5,100}$/

async function handleGetDoc(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  id: string,
  rlHeaders: Record<string, string>,
): Promise<Response> {
  if (!ID_RE.test(id)) {
    return jsonResponse(404, { error: 'not_found' }, rlHeaders)
  }

  const { data, error } = await supabase
    .from('vw_api_documentos')
    .select(ALLOWED_FIELDS.join(','))
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('api-v1: get doc query error', error.message)
    return jsonResponse(500, { error: 'internal_error' }, rlHeaders)
  }

  if (!data) {
    return jsonResponse(404, { error: 'not_found' }, rlHeaders)
  }

  const sanitized = stripPii(data as DocRow)
  return jsonResponse(200, { data: sanitized }, rlHeaders)
}

// ──────────────────────────────────────────────────────────────────────────
// Handler: GET /v1/docs/:id/changelog
//
// Retorna histórico paginado do documento. Valida primeiro que :id existe
// (e é público) consultando vw_api_documentos — assim o 404 é consistente
// com /v1/docs/:id: se o doc não é visível pela API, seu changelog também
// não é. Caso contrário, lista entries paginadas da view de changelog.
// ──────────────────────────────────────────────────────────────────────────
async function handleChangelog(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  id: string,
  url: URL,
  rlHeaders: Record<string, string>,
): Promise<Response> {
  if (!ID_RE.test(id)) {
    return jsonResponse(404, { error: 'not_found' }, rlHeaders)
  }

  // Step 1: validar que o doc existe E é público (mesma whitelist da view
  // principal). head:true evita transferir colunas — só conta.
  const { count: docCount, error: existsErr } = await supabase
    .from('vw_api_documentos')
    .select('id', { count: 'exact', head: true })
    .eq('id', id)

  if (existsErr) {
    console.error('api-v1: changelog exists-check error', existsErr.message)
    return jsonResponse(500, { error: 'internal_error' }, rlHeaders)
  }
  if (!docCount || docCount === 0) {
    return jsonResponse(404, { error: 'not_found' }, rlHeaders)
  }

  // Step 2: parsing seguro de paginação (mesma lógica de handleListDocs)
  const params = url.searchParams
  let limit = Number.parseInt(params.get('limit') ?? '', 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  let offset = Number.parseInt(params.get('offset') ?? '', 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  // Step 3: query do changelog
  const { data, error, count } = await supabase
    .from('vw_api_documentos_changelog')
    .select('id, documento_id, versao, acao, created_at', { count: 'exact' })
    .eq('documento_id', id)
    .order('created_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('api-v1: changelog query error', error.message)
    return jsonResponse(500, { error: 'internal_error' }, rlHeaders)
  }

  const rows = Array.isArray(data) ? (data as ApiChangelogEntry[]) : []

  return jsonResponse(
    200,
    {
      data: rows,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    },
    rlHeaders,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 15b — Handler: GET /v1/planos-acao
//
// Lista paginada de planos de ação PDCA via view vw_api_planos_acao.
// Espelha pattern de handleListDocs.
//
// Query string:
//   ?status=<estado>     filtro adicional (view já exclui 'cancelado')
//   ?limit=<n>           default 50, max 100
//   ?offset=<n>          default 0
//   ?q=<termo>           ILIKE em titulo
//
// Resposta: { data: ApiPlanoAcao[], pagination: { total, limit, offset } }
// ──────────────────────────────────────────────────────────────────────────
async function handleListPlanosAcao(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  url: URL,
  rlHeaders: Record<string, string>,
): Promise<Response> {
  const params = url.searchParams

  let limit = Number.parseInt(params.get('limit') ?? '', 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  let offset = Number.parseInt(params.get('offset') ?? '', 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  let query = supabase
    .from('vw_api_planos_acao')
    .select(ALLOWED_FIELDS_PLANOS_ACAO.join(','), { count: 'exact' })

  // Filtro adicional opcional — view já garante status <> 'cancelado',
  // mas user pode querer só 'concluido' ou 'em_andamento' etc.
  const status = params.get('status')
  if (status) query = query.eq('status', status)

  const q = params.get('q')
  if (q && q.trim().length > 0) {
    const term = q.trim().replace(/[%_]/g, '\\$&')
    query = query.ilike('titulo', `%${term}%`)
  }

  query = query.order('updated_at', { ascending: false, nullsFirst: false })
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    console.error('api-v1: list planos_acao query error', error.message)
    return jsonResponse(500, { error: 'internal_error' }, rlHeaders)
  }

  const rows = Array.isArray(data) ? data : []
  const sanitized = rows.map((row) => stripPiiPlanoAcao(row as DocRow))

  return jsonResponse(
    200,
    {
      data: sanitized,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    },
    rlHeaders,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 15b — Handler: GET /v1/comunicados
//
// Lista paginada de comunicados via view vw_api_comunicados.
// View já filtra status='publicado', arquivado=false e validade futura/NULL.
//
// Query string:
//   ?status=<estado>     filtro adicional (view já restringe a 'publicado')
//   ?limit=<n>           default 50, max 100
//   ?offset=<n>          default 0
//   ?q=<termo>           ILIKE em titulo
//
// Resposta: { data: ApiComunicado[], pagination: { total, limit, offset } }
// ──────────────────────────────────────────────────────────────────────────
async function handleListComunicados(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  url: URL,
  rlHeaders: Record<string, string>,
): Promise<Response> {
  const params = url.searchParams

  let limit = Number.parseInt(params.get('limit') ?? '', 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  let offset = Number.parseInt(params.get('offset') ?? '', 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  let query = supabase
    .from('vw_api_comunicados')
    .select(ALLOWED_FIELDS_COMUNICADOS.join(','), { count: 'exact' })

  // Filtro adicional opcional — view já restringe a status='publicado'.
  // Aceitar ?status=publicado é no-op; outros valores devolvem [].
  const status = params.get('status')
  if (status) query = query.eq('status', status)

  const tipo = params.get('tipo')
  if (tipo) query = query.eq('tipo', tipo)

  const ropArea = params.get('rop_area')
  if (ropArea) query = query.eq('rop_area', ropArea)

  const q = params.get('q')
  if (q && q.trim().length > 0) {
    const term = q.trim().replace(/[%_]/g, '\\$&')
    query = query.ilike('titulo', `%${term}%`)
  }

  query = query.order('updated_at', { ascending: false, nullsFirst: false })
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    console.error('api-v1: list comunicados query error', error.message)
    return jsonResponse(500, { error: 'internal_error' }, rlHeaders)
  }

  const rows = Array.isArray(data) ? data : []
  const sanitized = rows.map((row) => stripPiiComunicado(row as DocRow))

  return jsonResponse(
    200,
    {
      data: sanitized,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    },
    rlHeaders,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Handler: POST/PUT/DELETE — write handlers (Sprint 19)
//
// Wrapper que faz parse de body + dispatch para o resource-handler específico.
// LGPD: changedBy = tokenCreatedBy (admin que gerou o token), nunca 'system'.
//
// Resources suportados:
//   POST   /v1/docs              → cria documento (title, tipo, descricao)
//   PUT    /v1/docs/:id          → update parcial (title, descricao, tags, ...)
//   DELETE /v1/docs/:id          → soft-delete (status='arquivado')
//   (mesma estrutura para planos-acao e comunicados — handlers TODO Sprint 20)
// ──────────────────────────────────────────────────────────────────────────

// Sprint 19 hotfix — field names em snake_case PT (mirror src/services/
// supabaseDocumentService.js DOC_LIST_COLUMNS_BASE). Era 'title' (EN);
// correto é 'titulo'. Whitelist alinhada à tabela `documentos` real.
const DOC_WRITE_WHITELIST = [
  'titulo',
  'tipo',
  'descricao',
  'categoria',
  'subcategoria',
  'tags',
  'codigo',
  'numero_norma',
  'status',
  'data_validade',
  'setor_id',
  'setor_nome',
  'responsavel',
  'responsavel_revisao',
  'proxima_revisao',
  'intervalo_revisao_dias',
] as const

// Sanitiza body com whitelist explícita (defesa em profundidade vs RLS).
function pickWhitelisted<T extends string>(
  body: Record<string, unknown>,
  keys: readonly T[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      out[k] = body[k]
    }
  }
  return out
}

async function handleWrite(
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  pathname: string,
  changedBy: string,
  rlHeaders: Record<string, string>,
): Promise<Response> {
  let body: Record<string, unknown> = {}
  if (req.method !== 'DELETE') {
    try {
      const text = await req.text()
      body = text ? JSON.parse(text) : {}
    } catch {
      return jsonResponse(400, { error: 'invalid_json' }, rlHeaders)
    }
  }

  // POST /v1/docs — Sprint 19 hotfix: campos NOT NULL alinhados ao schema
  // (id custom format, titulo PT, categoria obrigatória, versao_atual=1,
  //  status='rascunho' default — espelha createDocument em supabaseDocumentService.js).
  if (req.method === 'POST' && (pathname === '/v1/docs' || pathname === '/v1/docs/')) {
    const sanitized = pickWhitelisted(body, DOC_WRITE_WHITELIST)
    if (!sanitized.titulo || !sanitized.tipo || !sanitized.categoria) {
      return jsonResponse(
        400,
        { error: 'validation_failed', message: 'titulo, tipo and categoria are required' },
        rlHeaders,
      )
    }
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const insertRow = {
      ...sanitized,
      id,
      versao_atual: 1,
      status: sanitized.status || 'rascunho',
      created_by: changedBy,
      created_by_name: 'API Token',
      created_by_email: 'api-token@anest.system',
    }
    const { data, error } = await supabase
      .from('documentos')
      .insert(insertRow)
      .select('id, titulo, tipo, categoria, status, created_at')
      .single()
    if (error) {
      console.error('api-v1: POST /v1/docs error', error.message, error.details, error.hint)
      return jsonResponse(
        500,
        { error: 'insert_failed', detail: error.message },
        rlHeaders,
      )
    }
    return jsonResponse(201, { data }, rlHeaders)
  }

  // PUT /v1/docs/:id — Sprint 19 hotfix: campos PT, sem last_modified_by
  // (coluna não existe — auditoria via documento_changelog trigger).
  const putMatch = pathname.match(/^\/v1\/docs\/([^/]+)\/?$/)
  if (req.method === 'PUT' && putMatch) {
    const id = putMatch[1]
    const sanitized = pickWhitelisted(body, DOC_WRITE_WHITELIST)
    if (Object.keys(sanitized).length === 0) {
      return jsonResponse(400, { error: 'no_fields_to_update' }, rlHeaders)
    }
    // Pre-check existence to distinguish 404 de erros de schema.
    const { data: existing } = await supabase
      .from('documentos')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!existing) {
      return jsonResponse(404, { error: 'not_found' }, rlHeaders)
    }
    const { data, error } = await supabase
      .from('documentos')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, titulo, tipo, categoria, status, updated_at')
      .maybeSingle()
    if (error) {
      console.error('api-v1: PUT /v1/docs error', error.message, error.details, error.hint)
      return jsonResponse(
        500,
        { error: 'update_failed', detail: error.message },
        rlHeaders,
      )
    }
    return jsonResponse(200, { data }, rlHeaders)
  }

  // DELETE /v1/docs/:id — soft delete via status='arquivado'.
  const delMatch = pathname.match(/^\/v1\/docs\/([^/]+)\/?$/)
  if (req.method === 'DELETE' && delMatch) {
    const id = delMatch[1]
    const { data: existing } = await supabase
      .from('documentos')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!existing) {
      return jsonResponse(404, { error: 'not_found' }, rlHeaders)
    }
    const { data, error } = await supabase
      .from('documentos')
      .update({ status: 'arquivado', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('api-v1: DELETE /v1/docs error', error.message, error.details, error.hint)
      return jsonResponse(
        500,
        { error: 'delete_failed', detail: error.message },
        rlHeaders,
      )
    }
    return jsonResponse(200, { data: { id, status: 'arquivado' } }, rlHeaders)
  }

  // /v1/planos-acao + /v1/comunicados writes — Sprint 20 (escopo + tabela
  // específicos requerem decisão de domínio que excede esta wave).
  return jsonResponse(
    501,
    {
      error: 'not_implemented',
      message: 'Write handlers para planos-acao e comunicados serão entregues em Sprint 20.',
    },
    rlHeaders,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const startedAt = Date.now()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // Sprint 19 — aceita GET (read) + POST/PUT/DELETE (write). Outros métodos: 405.
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return jsonResponse(405, { error: 'method_not_allowed' })
  }

  const url = new URL(req.url)
  // Edge functions são deployadas em /functions/v1/api-v1/<resto>.
  // Strip prefix (case-insensitive) para obter o caminho "lógico".
  let pathname = url.pathname
  const idx = pathname.toLowerCase().indexOf('/api-v1')
  if (idx >= 0) {
    pathname = pathname.slice(idx + '/api-v1'.length) || '/'
  }
  if (!pathname.startsWith('/')) pathname = '/' + pathname

  const ip = clientIp(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    console.error('api-v1: env não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return jsonResponse(500, { error: 'internal_error' })
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Auth
  const auth = await authenticate(req, supabase)
  if (!auth.ok) {
    console.log(
      'api-v1:',
      req.method,
      pathname,
      'anon',
      auth.status,
      `${Date.now() - startedAt}ms`,
    )
    return jsonResponse(auth.status, auth.body)
  }

  // 1.5 Scope enforcement (Sprint 16)
  // Aplicado ANTES do rate limit para que requests sem scope não consumam
  // budget de RL. Endpoints fora do mapa (e.g. /, /v1/foo) caem para 404 no
  // router (passa direto sem 403). 403 só faz sentido se sabemos o scope.
  const requiredScope = requiredScopeFor(req.method, pathname)
  if (requiredScope && !auth.scopes.includes(requiredScope)) {
    console.log(
      'api-v1:',
      req.method,
      pathname,
      'token',
      403,
      `${Date.now() - startedAt}ms`,
      `missing_scope=${requiredScope}`,
    )
    return jsonResponse(403, {
      error: 'forbidden',
      required_scope: requiredScope,
    })
  }

  // 2. Rate limit
  const rl = await checkRateLimit(supabase, ip)
  if (!rl.allowed) {
    const retryAfter = String(rl.retryAfter)
    console.log(
      'api-v1:',
      req.method,
      pathname,
      'token',
      429,
      `${Date.now() - startedAt}ms`,
      `ip=${ip}`,
    )
    return jsonResponse(
      429,
      { error: 'rate_limit_exceeded' },
      {
        'Retry-After': retryAfter,
        'X-RateLimit-Limit': String(RL_LIMIT),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(rl.resetSeconds),
      },
    )
  }
  const rlHeaders = rateHeaders(rl.remaining, rl.resetSeconds)

  // 3. Router — split por método (GET = read, POST/PUT/DELETE = write).
  let response: Response
  if (req.method === 'GET') {
    if (pathname === '/v1/docs' || pathname === '/v1/docs/') {
      response = await handleListDocs(supabase, url, rlHeaders)
    } else if (pathname === '/v1/planos-acao' || pathname === '/v1/planos-acao/') {
      response = await handleListPlanosAcao(supabase, url, rlHeaders)
    } else if (pathname === '/v1/comunicados' || pathname === '/v1/comunicados/') {
      response = await handleListComunicados(supabase, url, rlHeaders)
    } else {
      const changelogMatch = pathname.match(/^\/v1\/docs\/([^/]+)\/changelog\/?$/)
      const detailMatch = pathname.match(/^\/v1\/docs\/([^/]+)\/?$/)
      if (changelogMatch) {
        response = await handleChangelog(supabase, changelogMatch[1], url, rlHeaders)
      } else if (detailMatch) {
        response = await handleGetDoc(supabase, detailMatch[1], rlHeaders)
      } else {
        response = jsonResponse(404, { error: 'not_found' }, rlHeaders)
      }
    }
  } else {
    // Sprint 19 — write handlers. tokenCreatedBy é o admin que gerou o token,
    // usado como changedBy no audit log (regra: nunca 'system'/'admin').
    const { data: tokenRow } = await supabase
      .from('api_tokens')
      .select('created_by')
      .eq('id', auth.token_id)
      .maybeSingle()
    const tokenCreatedBy = tokenRow?.created_by || 'api-token'

    response = await handleWrite(req, supabase, pathname, tokenCreatedBy, rlHeaders)
  }

  console.log(
    'api-v1:',
    req.method,
    pathname,
    'token',
    response.status,
    `${Date.now() - startedAt}ms`,
  )
  return response
})
