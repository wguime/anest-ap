// Deploy:
//   bash scripts/deploy-edge-with-pat.sh get-supabase-token --no-verify-jwt
// ⚠️ --no-verify-jwt OBRIGATÓRIO: header Authorization carrega Firebase ID Token
// (não Supabase JWT). Sem essa flag, gateway Supabase rejeita com
// UNAUTHORIZED_INVALID_JWT_FORMAT antes do código rodar. Wave 2.1 incident.
import { jwtVerify, importX509, SignJWT } from 'https://deno.land/x/jose@v5.2.0/index.ts'

// CORS: allowlist com echo da Origin requisitante. Permite produção +
// preview Firebase + dev local (Vite). Env ALLOWED_ORIGINS (comma-separated)
// extende a lista sem redeploy. Origin desconhecida cai no default produção.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://anest-ap.web.app',
  'https://anest-ap.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
]
const ENV_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...ENV_ORIGINS])

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://anest-ap.web.app'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  }
}

// Cache Google's public keys for 1 hour
let cachedCerts: Record<string, string> | null = null
let certsExpiry = 0

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < certsExpiry) return cachedCerts
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  )
  if (!res.ok) throw new Error('Failed to fetch Google public keys')
  cachedCerts = await res.json()
  // Cache for 1 hour
  certsExpiry = Date.now() + 3600 * 1000
  return cachedCerts!
}

async function verifyFirebaseToken(idToken: string) {
  const certs = await getGoogleCerts()

  // Decode header to find kid
  const headerB64 = idToken.split('.')[0]
  const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')))
  const kid = header.kid
  if (!kid || !certs[kid]) {
    throw new Error('Unknown key ID in Firebase token')
  }

  const publicKey = await importX509(certs[kid], 'RS256')
  const { payload } = await jwtVerify(idToken, publicKey, {
    issuer: 'https://securetoken.google.com/anest-ap',
    audience: 'anest-ap',
  })

  return payload
}

// Onda1-4: clearance_level lookup.
// Lê profiles.clearance_level via REST com service-role para incluir como
// claim no JWT. Em qualquer falha (rede, perfil ausente, schema incompatível)
// retorna 'interno' por segurança — NÃO logamos o valor.
type ConfidentialityLevel = 'publico' | 'interno' | 'restrito' | 'sigiloso'

async function fetchClearanceLevel(firebaseUid: string): Promise<ConfidentialityLevel> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return 'interno'

  try {
    const url =
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(firebaseUid)}` +
      `&select=clearance_level&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) return 'interno'
    const rows = (await res.json()) as Array<{ clearance_level?: string }>
    const raw = rows?.[0]?.clearance_level
    if (raw === 'publico' || raw === 'interno' || raw === 'restrito' || raw === 'sigiloso') {
      return raw
    }
    return 'interno'
  } catch {
    return 'interno'
  }
}

// Wave 2.1 — Token blocklist check.
// Consulta public.is_token_revoked(firebase_uid) antes de emitir novo JWT.
// Se uid tem revoke ativo em token_blocklist, retorna true e Edge devolve 401.
// FAIL-CLOSED: erro de rede/RPC → assume NÃO revogado (avoid lockout em outage).
// Trade-off: revoke admin pode demorar até cache TTL (~10min) propagar se RPC falhar.
async function isTokenRevoked(firebaseUid: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    // Config missing — fail-open + log estruturado para alerta operacional.
    console.error('isTokenRevoked: config-missing (SUPABASE_URL/SERVICE_ROLE), fail-open')
    return false
  }

  try {
    const url = `${supabaseUrl}/rest/v1/rpc/is_token_revoked`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_firebase_uid: firebaseUid }),
    })
    if (!res.ok) {
      // RPC down/blocklist table missing — fail-open + log para alerta.
      // Monitoring deve disparar paging se este log aparecer com frequência.
      console.error('isTokenRevoked: rpc-error (fail-open)', { status: res.status })
      return false
    }
    const body = await res.json()
    return body === true
  } catch (err) {
    // Network outage / parse error — fail-open + log estruturado.
    console.error('isTokenRevoked: exception (fail-open)', {
      message: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// Wave 2.1 — gera jti (JWT ID) único por emissão. Permite revocation
// token-specific (Wave 2.2+) ao invés de uid-blanket. crypto.randomUUID() é
// padrão Deno + cripto-seguro.
function generateJti(): string {
  return crypto.randomUUID()
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const firebaseIdToken = authHeader.slice(7)
    const firebasePayload = await verifyFirebaseToken(firebaseIdToken)

    const jwtSecret = Deno.env.get('JWT_SECRET')
    if (!jwtSecret) throw new Error('JWT_SECRET not configured')

    const secretKey = new TextEncoder().encode(jwtSecret)
    const now = Math.floor(Date.now() / 1000)

    // Onda1-4: include clearance_level claim from profiles.clearance_level.
    // Default 'interno' on any lookup failure. Never logged.
    const firebaseUid = firebasePayload.sub as string

    // Wave 2.1 — Blocklist check ANTES de emitir.
    // Se admin revogou a sessão, JWT cache local cai no próximo refresh (≤10min)
    // pois fetch deste endpoint retorna 401 → client invalida cache + dispatch event.
    const revoked = await isTokenRevoked(firebaseUid)
    if (revoked) {
      return new Response(
        JSON.stringify({ error: 'session_revoked', message: 'Session has been revoked. Please re-authenticate.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const clearanceLevel = await fetchClearanceLevel(firebaseUid)

    const token = await new SignJWT({
      sub: firebaseUid,
      user_id: firebaseUid,
      email: (firebasePayload.email as string) || '',
      role: 'authenticated',
      clearance_level: clearanceLevel,
      iss: 'supabase',
      ref: Deno.env.get('PROJECT_REF') || 'vjzrahruvjffyyqyhjny',
      iat: now,
      exp: now + 3600,
      jti: generateJti(), // Wave 2.1: JWT ID para revocation token-specific futuro
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secretKey)

    return new Response(
      JSON.stringify({ token, expires_in: 3600 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('get-supabase-token error:', message)
    const status = message.includes('token') || message.includes('key') ? 401 : 500
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
