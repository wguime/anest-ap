// =============================================================================
// supabase/functions/api-v1/index.ts — Sprint 14c / O2-5
//
// API pública read-only para integração externa. Monolito com router interno
// por URL.pathname (segue precedente do projeto: edges autocontidas).
//
// Rotas:
//   GET /v1/docs                      → lista paginada de documentos (200)
//   GET /v1/docs/:id                  → documento único whitelisted (200/404)
//   GET /v1/docs/:id/changelog        → histórico paginado do doc (200/404)
//   *                                 → 404 { error: 'not_found' }
//
// Auth:
//   Header: Authorization: Bearer <token-raw>
//   Token raw → SHA-256 hex (Deno crypto.subtle) → RPC is_valid_api_token().
//   RPC atualiza last_used_at + usage_count (SECURITY DEFINER).
//   Falta header OU token inválido → 401 { error: 'invalid_token' }.
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
// Auth middleware
// ──────────────────────────────────────────────────────────────────────────
async function authenticate(
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
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

  const { data, error } = await supabase.rpc('is_valid_api_token', { p_token_hash: hash })
  if (error) {
    console.error('api-v1: is_valid_api_token RPC error', error.message)
    return { ok: false, status: 401, body: { error: 'invalid_token' } }
  }
  if (data !== true) {
    return { ok: false, status: 401, body: { error: 'invalid_token' } }
  }
  return { ok: true }
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
// Main
// ──────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const startedAt = Date.now()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'GET') {
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

  // 3. Router
  let response: Response
  if (pathname === '/v1/docs' || pathname === '/v1/docs/') {
    response = await handleListDocs(supabase, url, rlHeaders)
  } else {
    // Match /v1/docs/:id/changelog ANTES de /v1/docs/:id (mais específico vence).
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
