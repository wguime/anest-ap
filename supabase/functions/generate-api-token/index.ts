// =============================================================================
// supabase/functions/generate-api-token/index.ts — Sprint 14c / O2-5 (Wave 4/B4)
//
// Edge JWT-gated admin-only que gera um token raw para a API pública v1.
//
// Fluxo:
//   1. Recebe POST { name: string, scope?: 'read' } com Authorization: Bearer
//      <JWT custom HS256 ANEST> (mesmo JWT que outros edges privados consomem).
//   2. Valida JWT com JWT_SECRET (HS256). sub = Firebase UID.
//   3. Confirma que o sub corresponde a um admin (admin_users.firebase_uid).
//      ATENÇÃO: o RPC public.is_admin() existe (002_rls.sql), MAS depende de
//      current_setting('request.jwt.claims'); ao chamar com service_role esse
//      claim NÃO está populado. Por isso fazemos lookup direto em admin_users.
//   4. Gera 32 bytes random → hex (64 chars) = token plain.
//   5. SHA-256(token) → hex (64 chars) = token_hash (mesmo formato do api-v1).
//   6. INSERT em api_tokens (token_hash, name, scope, created_by=adminUid).
//   7. Response 201 { token, id, name, scope, created_at }.
//
// IMPORTANTE: o campo `token` na resposta é o ÚNICO momento em que o token
// plain é retornado. Backend nunca mais o vê (só armazenamos o hash). UI
// deve mostrá-lo uma vez com aviso explícito de copiar.
//
// Errors:
//   400 invalid_payload     — name ausente, < 3 chars, scope inválido
//   401 missing_token       — sem header Authorization
//   401 invalid_token       — JWT inválido / expirado / sem sub
//   403 forbidden_not_admin — JWT.sub não é admin
//   500 internal_error      — JWT_SECRET ausente, ou erro inesperado
//   500 supabase_error      — erro de INSERT/lookup no Supabase
//
// Logs: estruturados via console.log/error com prefixo "generate-api-token:".
//
// Env vars (providas pela Supabase em deploy):
//   JWT_SECRET                  — secret HS256 do JWT custom ANEST
//   SUPABASE_URL                — URL do projeto
//   SUPABASE_SERVICE_ROLE_KEY   — service-role (lê admin_users, escreve api_tokens)
//
// Deploy:
//   bash scripts/deploy-edge-with-pat.sh generate-api-token --no-verify-jwt
// ⚠️ --no-verify-jwt OBRIGATÓRIO: header Authorization carrega JWT HS256 custom
// ANEST (não Supabase JWT). Sem essa flag, gateway Supabase rejeita com
// UNAUTHORIZED_INVALID_JWT_FORMAT antes do código rodar. Wave 2.1 incident.
// =============================================================================

import { jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const ALLOWED_SCOPES = new Set(['read'])
// Sprint 19 — whitelist granular expandida com 3 write scopes. Default
// (sem body.scopes) continua read-only (back-compat); write é opt-in.
const VALID_GRANULAR_SCOPES = new Set([
  'read:docs', 'read:planos-acao', 'read:comunicados',
  'write:docs', 'write:planos-acao', 'write:comunicados',
])
const DEFAULT_GRANULAR_SCOPES = ['read:docs', 'read:planos-acao', 'read:comunicados']
const MIN_NAME_LEN = 3
const MAX_NAME_LEN = 80

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hashBuf))
}

function generateRawToken(): string {
  // 32 bytes random → 64 hex chars. Mais entropia (256 bits) do que UUIDv4×2.
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'method_not_allowed' })
  }

  // ─── 1. Authorization header ──────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { ok: false, reason: 'missing_token' })
  }

  const jwtSecret = Deno.env.get('JWT_SECRET')
  if (!jwtSecret) {
    console.error('generate-api-token: JWT_SECRET ausente')
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }

  // ─── 2. JWT validate (HS256) ──────────────────────────────────────────
  let adminUid = ''
  try {
    const secretKey = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(authHeader.slice(7), secretKey, {
      algorithms: ['HS256'],
    })
    adminUid = typeof payload.sub === 'string' ? payload.sub : ''
    if (!adminUid) throw new Error('sub claim ausente')
  } catch (_err) {
    return jsonResponse(401, { ok: false, reason: 'invalid_token' })
  }

  // ─── 3. Admin gate ────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('generate-api-token: SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .select('firebase_uid')
    .eq('firebase_uid', adminUid)
    .maybeSingle()

  if (adminErr) {
    console.error('generate-api-token: admin lookup error', adminErr.message)
    return jsonResponse(500, { ok: false, reason: 'supabase_error' })
  }
  if (!adminRow) {
    console.log('generate-api-token: forbidden_not_admin', { sub: adminUid })
    return jsonResponse(403, { ok: false, reason: 'forbidden_not_admin' })
  }

  // ─── 4. Body validation ───────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const scope = typeof body.scope === 'string' && body.scope ? body.scope : 'read'

  // Sprint 16 / v4.0.0 — scopes granulares opcionais. Default = 3 scopes (≡ legacy scope='read').
  // Quando caller passa, valida cada item contra a whitelist; rejeita array vazio.
  let scopes: string[] = DEFAULT_GRANULAR_SCOPES
  if (Array.isArray(body.scopes)) {
    if (body.scopes.length === 0) {
      return jsonResponse(400, {
        ok: false,
        reason: 'invalid_payload',
        detail: 'scopes must have at least 1 value',
      })
    }
    for (const s of body.scopes) {
      if (typeof s !== 'string' || !VALID_GRANULAR_SCOPES.has(s)) {
        return jsonResponse(400, {
          ok: false,
          reason: 'invalid_payload',
          detail: `scopes must be subset of: ${Array.from(VALID_GRANULAR_SCOPES).join(', ')}`,
        })
      }
    }
    scopes = body.scopes as string[]
  }

  if (name.length < MIN_NAME_LEN || name.length > MAX_NAME_LEN) {
    return jsonResponse(400, {
      ok: false,
      reason: 'invalid_payload',
      detail: `name must be ${MIN_NAME_LEN}-${MAX_NAME_LEN} chars`,
    })
  }
  if (!ALLOWED_SCOPES.has(scope)) {
    return jsonResponse(400, {
      ok: false,
      reason: 'invalid_payload',
      detail: `scope must be one of: ${Array.from(ALLOWED_SCOPES).join(', ')}`,
    })
  }

  // ─── 5. Token gen + hash ──────────────────────────────────────────────
  const tokenPlain = generateRawToken()
  let tokenHash: string
  try {
    tokenHash = await sha256Hex(tokenPlain)
  } catch (err) {
    console.error('generate-api-token: hash error', err)
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }

  // ─── 6. INSERT ────────────────────────────────────────────────────────
  // created_by = adminUid REAL do JWT (audit trail — nunca hardcoded).
  // Wave 2.1: expires_at default 1 ano. CHECK constraint api_tokens_active_must_expire
  // exige expires_at NOT NULL para tokens ativos (revoked_at IS NULL).
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const { data: inserted, error: insertErr } = await supabase
    .from('api_tokens')
    .insert({
      token_hash: tokenHash,
      name,
      scope,
      scopes,
      created_by: adminUid,
      expires_at: expiresAt,
    })
    .select('id, name, scope, scopes, created_at, expires_at')
    .single()

  if (insertErr || !inserted) {
    console.error('generate-api-token: insert error', insertErr?.message)
    return jsonResponse(500, { ok: false, reason: 'supabase_error' })
  }

  console.log('generate-api-token: ok', { id: inserted.id, name: inserted.name, by: adminUid })

  // ─── 7. Response — TOKEN PLAIN É RETORNADO AQUI UMA ÚNICA VEZ ─────────
  // Após este momento, o backend só conhece o hash. Cliente deve copiar
  // e armazenar; reveal subsequente é impossível.
  return jsonResponse(201, {
    ok: true,
    token: tokenPlain,
    id: inserted.id,
    name: inserted.name,
    scope: inserted.scope,
    scopes: inserted.scopes,
    created_at: inserted.created_at,
    expires_at: inserted.expires_at,
  })
})
