import { jwtVerify, importX509, SignJWT } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://anest-ap.web.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

Deno.serve(async (req) => {
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
