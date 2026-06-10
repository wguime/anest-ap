/**
 * verify-auth.ts — verificação de Authorization compartilhada (aceitação dupla).
 *
 * Migração Firebase Third-Party Auth (plano 2026-06): durante a transição as
 * edges aceitam DOIS formatos de token no header Authorization:
 *   1. JWT custom HS256 emitido por get-supabase-token (legado, JWT_SECRET)
 *   2. Firebase ID Token RS256 nativo (Google public keys, projeto anest-ap)
 *
 * O discriminador é o `alg` do header do JWT — determinístico, sem try/fallback.
 * Após o descomissionamento (Fase 1.6) o ramo HS256 será removido.
 *
 * Uso nas edges:
 *   import { verifyAuthHeader } from '../_shared/verify-auth.ts'
 *   const auth = await verifyAuthHeader(req.headers.get('authorization'))
 *   if (!auth.ok) return jsonResponse(auth.status, { ok: false, reason: auth.reason })
 *   const uid = auth.uid  // Firebase UID (claim sub em ambos os formatos)
 */
import { jwtVerify, importX509 } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const FIREBASE_PROJECT_ID = 'anest-ap'
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// Cache das chaves públicas do Google (1h) — mesmo padrão de get-supabase-token
let cachedCerts: Record<string, string> | null = null
let certsExpiry = 0

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < certsExpiry) return cachedCerts
  const res = await fetch(GOOGLE_CERTS_URL)
  if (!res.ok) throw new Error('Failed to fetch Google public keys')
  cachedCerts = await res.json()
  certsExpiry = Date.now() + 3600 * 1000
  return cachedCerts!
}

function decodeHeader(token: string): { alg?: string; kid?: string } {
  try {
    const b64 = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch {
    return {}
  }
}

export interface AuthOk {
  ok: true
  uid: string
  email: string
  /** 'hs256-legacy' = JWT custom get-supabase-token; 'firebase' = ID token nativo */
  source: 'hs256-legacy' | 'firebase'
  payload: Record<string, unknown>
}

export interface AuthErr {
  ok: false
  status: 401 | 500
  reason: 'missing_token' | 'invalid_token' | 'internal_error'
}

export type AuthResult = AuthOk | AuthErr

/**
 * Verifica o header Authorization aceitando JWT HS256 legado OU Firebase ID
 * Token RS256. Retorna uid (= Firebase UID via claim `sub`) e email.
 */
export async function verifyAuthHeader(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, reason: 'missing_token' }
  }
  const token = authHeader.slice(7)
  const { alg, kid } = decodeHeader(token)

  try {
    if (alg === 'HS256') {
      const jwtSecret = Deno.env.get('JWT_SECRET')
      if (!jwtSecret) {
        console.error('verify-auth: JWT_SECRET ausente')
        return { ok: false, status: 500, reason: 'internal_error' }
      }
      const secretKey = new TextEncoder().encode(jwtSecret)
      const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] })
      const uid = typeof payload.sub === 'string' ? payload.sub : ''
      if (!uid) throw new Error('sub claim ausente')
      return {
        ok: true,
        uid,
        email: typeof payload.email === 'string' ? payload.email : '',
        source: 'hs256-legacy',
        payload: payload as Record<string, unknown>,
      }
    }

    if (alg === 'RS256') {
      // Falha de rede ao buscar chaves do Google = problema de infra (500),
      // não token inválido (401) — não mascarar erro transitório.
      let certs: Record<string, string>
      try {
        certs = await getGoogleCerts()
      } catch (err) {
        console.error('verify-auth: falha ao buscar Google certs', {
          message: err instanceof Error ? err.message : String(err),
        })
        return { ok: false, status: 500, reason: 'internal_error' }
      }
      if (!kid || !certs[kid]) throw new Error('Unknown key ID in Firebase token')
      const publicKey = await importX509(certs[kid], 'RS256')
      const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      })
      const uid = typeof payload.sub === 'string' ? payload.sub : ''
      if (!uid) throw new Error('sub claim ausente')
      return {
        ok: true,
        uid,
        email: typeof payload.email === 'string' ? payload.email : '',
        source: 'firebase',
        payload: payload as Record<string, unknown>,
      }
    }

    throw new Error(`alg não suportado: ${alg}`)
  } catch (_err) {
    return { ok: false, status: 401, reason: 'invalid_token' }
  }
}
