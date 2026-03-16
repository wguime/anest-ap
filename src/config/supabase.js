/**
 * Supabase Client Configuration
 * Integração híbrida: Firebase Auth (JWT) + Supabase (PostgreSQL + Storage)
 *
 * Obtém um JWT Supabase via Edge Function server-side que:
 * - Recebe o Firebase ID Token
 * - Verifica com Google public keys
 * - Assina JWT Supabase (HS256) server-side
 * O JWT Secret NUNCA sai do servidor.
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

/**
 * JWT cache — avoid calling the Edge Function on every Supabase request.
 * Cached per Firebase UID with a 50-minute TTL (tokens expire in 60 min).
 */
let _cachedToken = null
let _cachedUid = null
let _cachedExp = 0

const TOKEN_TTL_MS = 50 * 60 * 1000 // refresh 10 min before expiry

/**
 * Get a Supabase-compatible JWT by calling the Edge Function.
 * The Edge Function verifies the Firebase ID Token and returns a signed
 * Supabase JWT. Results are cached and reused until 10 minutes before expiry.
 */
export async function getSupabaseToken() {
  await _authReady // Wait for Firebase Auth to restore persisted session
  const currentUser = auth.currentUser
  if (!currentUser) return null

  // Return cached token if still valid and same user
  if (
    _cachedToken &&
    _cachedUid === currentUser.uid &&
    Date.now() < _cachedExp
  ) {
    return _cachedToken
  }

  try {
    // Get Firebase ID Token
    const firebaseIdToken = await currentUser.getIdToken()

    // Call Edge Function to get Supabase JWT
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

    // Cache the token
    _cachedToken = token
    _cachedUid = currentUser.uid
    _cachedExp = Date.now() + TOKEN_TTL_MS

    return token
  } catch (error) {
    console.error('[Supabase] Failed to get token from Edge Function:', error)
    // Clear cache on error
    _cachedToken = null
    _cachedUid = null
    _cachedExp = 0
    // Notify the app so the UI can show feedback to the user
    window.dispatchEvent(new CustomEvent('supabase-token-error', {
      detail: { message: error.message },
    }))
    return null
  }
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
