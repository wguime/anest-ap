/**
 * Supabase Client Configuration
 * Integração: Firebase Auth → Supabase via Third-Party Auth nativo.
 *
 * Caminho preferencial (desde 2026-06-10): o próprio Firebase ID Token
 * (RS256) é enviado ao Supabase — a integração Third-Party Auth valida
 * no gateway. Requer o custom claim `role: 'authenticated'` no usuário
 * (Cloud Function setRoleClaimOnCreate + backfill set-role-claims.js).
 *
 * Fallback legado (até a Fase 1.6 de descomissionamento): usuários cujo
 * token ainda não tem o claim usam a Edge Function get-supabase-token,
 * que valida o ID Token e assina um JWT HS256. As Edge Functions do
 * projeto aceitam ambos os formatos (_shared/verify-auth.ts).
 */
import { createClient } from '@supabase/supabase-js'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Supabase features will not work.'
  )
}

/**
 * Auth-ready gate — waits for Firebase Auth to restore persisted session.
 * The first onAuthStateChanged callback fires once auth state is determined
 * (either user restored or null). Without this, getSupabaseToken() would
 * read auth.currentUser as null during cold start, causing all Supabase
 * queries to run as anonymous and return 0 rows via RLS.
 */
let _authReadyResolve
const _authReady = new Promise((resolve) => { _authReadyResolve = resolve })
const _unsubAuthReady = onAuthStateChanged(auth, () => {
  _authReadyResolve()
  _unsubAuthReady()
})

function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch {
    return {}
  }
}

/**
 * Decisão de caminho por UID, 1x por sessão: se o token não traz o claim
 * `role`, forçamos UM refresh (claim pode ter sido aplicado após a emissão).
 * Sem claim mesmo após refresh → caminho legado até o próximo login.
 */
let _claimCheckedUid = null
let _hasRoleClaim = false

/** Caminho legado — JWT cache (50 min; tokens expiram em 60). */
let _cachedToken = null
let _cachedUid = null
let _cachedExp = 0
const TOKEN_TTL_MS = 50 * 60 * 1000

async function getLegacyToken(currentUser) {
  if (
    _cachedToken &&
    _cachedUid === currentUser.uid &&
    Date.now() < _cachedExp
  ) {
    return _cachedToken
  }
  try {
    const firebaseIdToken = await currentUser.getIdToken()
    const response = await fetch(
      `${supabaseUrl}/functions/v1/get-supabase-token`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firebaseIdToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }
    const { token } = await response.json()
    _cachedToken = token
    _cachedUid = currentUser.uid
    _cachedExp = Date.now() + TOKEN_TTL_MS
    return token
  } catch (error) {
    console.error('[Supabase] Failed to get token from Edge Function:', error)
    _cachedToken = null
    _cachedUid = null
    _cachedExp = 0
    window.dispatchEvent(new CustomEvent('supabase-token-error', {
      detail: { message: error.message },
    }))
    return null
  }
}

/**
 * Token para chamadas Supabase (Data API, Storage, Realtime e Edges).
 * Preferência: Firebase ID Token nativo; fallback: JWT legado da edge.
 */
export async function getSupabaseToken() {
  await _authReady
  const currentUser = auth.currentUser
  if (!currentUser) return null

  try {
    let idToken = await currentUser.getIdToken()
    if (_claimCheckedUid !== currentUser.uid) {
      let payload = decodeJwtPayload(idToken)
      if (payload.role !== 'authenticated') {
        // Claim pode ter sido aplicado depois da emissão — força refresh 1x
        idToken = await currentUser.getIdToken(true)
        payload = decodeJwtPayload(idToken)
      }
      _claimCheckedUid = currentUser.uid
      _hasRoleClaim = payload.role === 'authenticated'
      if (!_hasRoleClaim) {
        console.warn(
          '[Supabase] ID token sem claim role=authenticated — usando ponte legada. ' +
          'Rode functions/set-role-claims.js para migrar este usuário.'
        )
      }
    }
    if (_hasRoleClaim) return idToken
  } catch (error) {
    console.warn('[Supabase] Firebase ID token indisponível, tentando ponte legada:', error?.message)
  }

  return getLegacyToken(currentUser)
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  accessToken: getSupabaseToken,
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

export default supabase
