/**
 * Supabase API Tokens Service — Sprint 14c / O2-5 (Wave 4 / B4)
 *
 * Gestão de tokens da API pública v1 (read-only). Toda escrita (gerar/revogar)
 * é admin-only via RLS (`is_admin()`); leitura também admin-only.
 *
 * Serviço expõe três operações:
 *   • fetchTokens({ includeRevoked })  — SELECT em api_tokens
 *   • revokeToken(tokenId, userInfo)   — UPDATE revoked_at = now()
 *   • generateToken({ name, scope })   — chama edge `generate-api-token`
 *
 * generateToken é uma fetch para a Edge function (não INSERT direto), porque
 * só a edge sabe gerar o token raw + computar o hash. O frontend NUNCA vê
 * `token_hash`, e o backend NUNCA vê o `token` plain depois desse momento.
 *
 * Audit trail: `revokeToken` grava em `permission_audit_log` com changedBy
 * = uid real do admin que clicou. NUNCA hardcoded.
 *
 * @todo (Sprint 16+) Suporte a scopes granulares.
 * Hoje todos os tokens têm scope 'read' único.
 * Futuro: 'read:docs', 'read:planos-acao', 'read:comunicados', etc.
 * Requer migration na coluna scope da tabela documento_api_tokens.
 */
import { supabase, getSupabaseToken } from '@/config/supabase'

// ============================================================================
// FIELD MAPPING — snake_case (DB) ↔ camelCase (JS)
// ============================================================================

function rowToCamel(row) {
  if (!row || typeof row !== 'object') return row
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
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
    .select('id, name, scope, created_by, created_at, revoked_at, last_used_at, usage_count')
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
    .select('id, name, scope, created_by, created_at, revoked_at, last_used_at, usage_count')
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
 *   3. Persiste só o hash
 *   4. Retorna o plain UMA vez
 *
 * O caller (UI) DEVE mostrar o token plain ao usuário imediatamente com
 * aviso de copiar — não há reveal subsequente.
 *
 * @param {object} input
 * @param {string} input.name
 * @param {'read'} [input.scope='read']
 * @returns {Promise<{token: string, id: string, name: string, scope: string, created_at: string}>}
 */
async function generateToken({ name, scope = 'read' } = {}) {
  if (!name || String(name).trim().length < 3) {
    throw new Error('Nome obrigatório (mínimo 3 caracteres).')
  }

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
    body: JSON.stringify({ name: String(name).trim(), scope }),
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
    created_at: body.created_at,
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const supabaseApiTokensService = {
  fetchTokens,
  revokeToken,
  generateToken,
}

export default supabaseApiTokensService
export { fetchTokens, revokeToken, generateToken, rowToCamel }
