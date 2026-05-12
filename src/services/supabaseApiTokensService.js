/**
 * Supabase API Tokens Service — Sprint 14c / O2-5 (Wave 4 / B4) + Sprint 16 (scopes granular)
 *
 * Gestão de tokens da API pública v1 (read-only). Toda escrita (gerar/revogar)
 * é admin-only via RLS (`is_admin()`); leitura também admin-only.
 *
 * Serviço expõe três operações:
 *   • fetchTokens({ includeRevoked })       — SELECT em api_tokens
 *   • revokeToken(tokenId, userInfo)        — UPDATE revoked_at = now()
 *   • generateToken({ name, scope, scopes }) — chama edge `generate-api-token`
 *
 * generateToken é uma fetch para a Edge function (não INSERT direto), porque
 * só a edge sabe gerar o token raw + computar o hash. O frontend NUNCA vê
 * `token_hash`, e o backend NUNCA vê o `token` plain depois desse momento.
 *
 * Audit trail: `revokeToken` grava em `permission_audit_log` com changedBy
 * = uid real do admin que clicou. NUNCA hardcoded.
 *
 * Sprint 16 — Scopes granulares:
 *   3 scopes válidos: read:docs, read:planos-acao, read:comunicados.
 *   `createApiToken` aceita `scopes: string[]` (default = todos os 3 ≡ legacy
 *   scope='read'). Whitelist é enforced em 3 lugares (defesa em camadas):
 *     1. validateScopes() neste service (throws antes de hit no DB).
 *     2. CHECK constraint `api_tokens_scopes_subset_check` no banco.
 *     3. Edge api-v1: ENDPOINT_SCOPES map + 403 se faltar.
 */
import { supabase, getSupabaseToken } from '@/config/supabase'

// ============================================================================
// SCOPES — whitelist canônica (Sprint 16)
//
// Espelha o CHECK constraint da migration 20260513120000. Mudar aqui exige
// mudar a migration (e vice-versa). Object.freeze evita mutação acidental.
// ============================================================================

const VALID_SCOPES = Object.freeze([
  'read:docs',
  'read:planos-acao',
  'read:comunicados',
])

/**
 * Valida que `scopes` é um array de strings dentro da whitelist VALID_SCOPES.
 * Throws com mensagem descritiva em qualquer violação. Usado pre-DB para
 * fail-fast antes de hit no constraint do Postgres.
 *
 * @param {unknown} scopes
 * @returns {string[]} o mesmo array (passthrough) se válido
 * @throws {Error} se não-array, vazio, ou contém scope desconhecido
 */
function validateScopes(scopes) {
  if (!Array.isArray(scopes)) {
    throw new Error('validateScopes: scopes deve ser um array de strings.')
  }
  if (scopes.length === 0) {
    throw new Error('validateScopes: scopes não pode ser vazio.')
  }
  for (const s of scopes) {
    if (typeof s !== 'string' || !VALID_SCOPES.includes(s)) {
      throw new Error(
        `validateScopes: scope desconhecido "${s}". Permitidos: ${VALID_SCOPES.join(', ')}.`
      )
    }
  }
  return scopes
}

// ============================================================================
// FIELD MAPPING — snake_case (DB) ↔ camelCase (JS)
// ============================================================================

function rowToCamel(row) {
  if (!row || typeof row !== 'object') return row
  const hasExplicitScopes = Array.isArray(row.scopes) && row.scopes.length > 0
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    // Sprint 16 — scopes text[]; fallback p/ os 3 legacy quando NULL/vazio
    // (back-compat com tokens pré-migration 20260513120000).
    scopes: hasExplicitScopes ? row.scopes : [...VALID_SCOPES],
    // Sprint 16 — true quando a row do banco NÃO tinha scopes explícitos
    // (token criado antes da migration 20260513120000). UI usa para mostrar
    // indicador "legacy" sem mudar a semântica funcional.
    legacyScopes: !hasExplicitScopes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count ?? 0,
  }
}

// ============================================================================
// ERROR HANDLING (espelha padrão do supabaseUsersService)
// ============================================================================

function handleError(error, context) {
  if (!error) return
  let msg = error.message || String(error)
  if (error.code === '42501' || msg.includes('permission denied')) {
    msg = 'Permissao negada (RLS) — apenas administradores podem gerenciar tokens API.'
  } else if (error.code === 'PGRST301' || msg.includes('JWT')) {
    msg = 'Token de autenticacao invalido ou expirado. Faca logout e login novamente.'
  }
  throw new Error(`${context}: ${msg}`)
}

async function logAudit(tokenId, changedBy, action, oldValue, newValue) {
  if (!changedBy) {
    // Auditoria sem actor é violação de contrato (audit-trail rule).
    console.warn('[supabaseApiTokensService] logAudit sem changedBy:', action)
    return
  }
  const { error } = await supabase.from('permission_audit_log').insert({
    target_user_id: tokenId, // id do token (UUID) — usa o slot target genérico
    changed_by: changedBy,
    action,
    old_value: oldValue,
    new_value: newValue,
  })
  if (error) {
    // Audit não-crítico — log mas não falha a operação.
    console.warn('[supabaseApiTokensService] audit log failed:', error.message)
  }
}

// ============================================================================
// FETCH (admin-only via RLS)
// ============================================================================

/**
 * Lista tokens API. Sem includeRevoked, retorna só os ativos.
 *
 * @param {object} opts
 * @param {boolean} [opts.includeRevoked=false]
 * @returns {Promise<Array>} tokens em camelCase
 */
async function fetchTokens({ includeRevoked = false } = {}) {
  let query = supabase
    .from('api_tokens')
    .select('id, name, scope, scopes, created_by, created_at, revoked_at, last_used_at, usage_count')
    .order('created_at', { ascending: false })

  if (!includeRevoked) {
    query = query.is('revoked_at', null)
  }

  const { data, error } = await query
  if (error) handleError(error, 'fetchTokens')
  return (data || []).map(rowToCamel)
}

// ============================================================================
// REVOKE (admin-only via RLS)
// ============================================================================

/**
 * Revoga um token marcando revoked_at = now(). Idempotente: tokens já
 * revogados ficam inalterados (filtro WHERE revoked_at IS NULL no UPDATE).
 *
 * @param {string} tokenId  UUID do token
 * @param {object} userInfo { uid, ... } — quem está revogando (audit trail)
 * @returns {Promise<object>} token atualizado
 */
async function revokeToken(tokenId, userInfo) {
  const changedBy = userInfo?.uid || userInfo?.id
  if (!tokenId) {
    throw new Error('[supabaseApiTokensService.revokeToken] tokenId obrigatório')
  }
  if (!changedBy) {
    // Audit trail obrigatório — nunca hardcoded.
    throw new Error(
      '[supabaseApiTokensService.revokeToken] userInfo.uid obrigatório (audit trail).'
    )
  }

  const { data, error } = await supabase
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .is('revoked_at', null)
    .select('id, name, scope, scopes, created_by, created_at, revoked_at, last_used_at, usage_count')
    .single()

  if (error) handleError(error, 'revokeToken')

  await logAudit(tokenId, changedBy, 'api_token_revoke', null, {
    tokenId,
    name: data?.name,
    revokedAt: data?.revoked_at,
  })

  return rowToCamel(data)
}

// ============================================================================
// GENERATE — chama Edge function (que devolve token plain UMA vez)
// ============================================================================

/**
 * Gera um novo token API. Chama a edge `generate-api-token` que:
 *   1. Valida JWT (admin-only)
 *   2. Gera token raw (32 bytes hex)
 *   3. Persiste só o hash + scopes (text[])
 *   4. Retorna o plain UMA vez
 *
 * O caller (UI) DEVE mostrar o token plain ao usuário imediatamente com
 * aviso de copiar — não há reveal subsequente.
 *
 * Sprint 16 — `scopes` é opcional; default = todos os 3 (≡ legacy scope='read').
 * Quando passado, é validado client-side (validateScopes) ANTES de chamar a
 * edge, então erros de scope inválido falham rápido sem hit no DB.
 *
 * @param {object} input
 * @param {string} input.name
 * @param {'read'} [input.scope='read']   legacy, mantido p/ back-compat
 * @param {string[]} [input.scopes]        Sprint 16 — subset de VALID_SCOPES
 * @returns {Promise<{token: string, id: string, name: string, scope: string, scopes: string[], created_at: string}>}
 */
async function generateToken({ name, scope = 'read', scopes } = {}) {
  if (!name || String(name).trim().length < 3) {
    throw new Error('Nome obrigatório (mínimo 3 caracteres).')
  }

  // Sprint 16 — default = 3 scopes (≡ legacy scope='read'). Quando o caller
  // passa explicitamente, validamos contra a whitelist antes de qualquer I/O.
  const finalScopes =
    scopes === undefined ? [...VALID_SCOPES] : validateScopes(scopes)

  const jwt = await getSupabaseToken()
  if (!jwt) {
    throw new Error('Sessão expirada. Faça login novamente para gerar tokens.')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurada.')
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/generate-api-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      // apikey é exigido pelo gateway das edges mesmo com verify-jwt off
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify({
      name: String(name).trim(),
      scope,
      scopes: finalScopes,
    }),
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok || !body?.ok) {
    const reason = body?.reason || `http_${res.status}`
    const detail = body?.detail ? ` — ${body.detail}` : ''
    throw new Error(`generateToken: ${reason}${detail}`)
  }

  return {
    token: body.token,
    id: body.id,
    name: body.name,
    scope: body.scope,
    // Edge pode (ainda) não devolver scopes; fallback p/ os que pedimos.
    scopes: Array.isArray(body.scopes) ? body.scopes : finalScopes,
    created_at: body.created_at,
  }
}

/**
 * Sprint 16 — alias semântico de `generateToken` com nome canônico do
 * contrato de API v2. `createApiToken({ name, scopes })` é o caminho
 * recomendado para novas integrações; `generateToken` permanece exportado
 * por back-compat com call sites já existentes (UI admin).
 *
 * @param {object} input
 * @param {string} input.name
 * @param {string[]} [input.scopes]  default = todos os 3 scopes válidos
 * @param {'read'} [input.scope='read']
 */
async function createApiToken({ name, scopes, scope = 'read' } = {}) {
  return generateToken({ name, scope, scopes })
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseApiTokensService = {
  fetchTokens,
  revokeToken,
  generateToken,
  createApiToken,
  validateScopes,
  VALID_SCOPES,
}

export default supabaseApiTokensService
export {
  fetchTokens,
  revokeToken,
  generateToken,
  createApiToken,
  rowToCamel,
  validateScopes,
  VALID_SCOPES,
}
