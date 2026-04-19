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

    const token = await new SignJWT({
      sub: firebasePayload.sub as string,
      user_id: firebasePayload.sub as string,
      email: (firebasePayload.email as string) || '',
      role: 'authenticated',
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
