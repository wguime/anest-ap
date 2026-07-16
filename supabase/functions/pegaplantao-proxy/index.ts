// Authorization: aceita JWT HS256 legado OU Firebase ID Token (RS256) — ver _shared/verify-auth.ts
import { verifyAuthHeader } from '../_shared/verify-auth.ts'

// CORS: allowlist com echo da Origin requisitante (padrão do projeto — origem
// única quebrava o dev local e a Home mostrava "Dados de demonstração" no
// localhost). Env ALLOWED_ORIGINS (comma-separated) extende sem redeploy.
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const PEGAPLANTAO_BASE = 'https://www.pegaplantao.com.br'

// In-memory OAuth token cache
let oauthToken: string | null = null
let oauthExpiry = 0

async function authenticatePegaPlantao(): Promise<string> {
  if (oauthToken && Date.now() < oauthExpiry) return oauthToken

  const clientId = Deno.env.get('PEGAPLANTAO_CLIENT_ID')!
  const clientSecret = Deno.env.get('PEGAPLANTAO_CLIENT_SECRET')!
  const username = Deno.env.get('PEGAPLANTAO_USERNAME')!
  const password = Deno.env.get('PEGAPLANTAO_PASSWORD')!

  const credentials = btoa(`${clientId}:${clientSecret}`)

  const res = await fetch(`${PEGAPLANTAO_BASE}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    }).toString(),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`PegaPlantao auth failed: ${res.status} - ${errorText}`)
  }

  const data = await res.json()
  oauthToken = data.access_token
  // Refresh 1 minute before expiry
  oauthExpiry = Date.now() + (data.expires_in - 60) * 1000
  return oauthToken!
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller's JWT (HS256 legado OU Firebase ID Token RS256)
    const auth = await verifyAuthHeader(req.headers.get('authorization'))
    if (!auth.ok) {
      const errorMessage = auth.reason === 'missing_token'
        ? 'Missing or invalid Authorization header'
        : auth.reason === 'internal_error'
          ? 'JWT_SECRET not configured'
          : 'Invalid token'
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse request
    const { endpoint, method = 'GET', body } = await req.json()
    if (!endpoint || typeof endpoint !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "endpoint"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get PegaPlantao token
    let ppToken = await authenticatePegaPlantao()

    // Make request to PegaPlantao
    const url = `${PEGAPLANTAO_BASE}${endpoint}`
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${ppToken}`,
        'Content-Type': 'application/json',
      },
    }
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    let res = await fetch(url, fetchOptions)

    // If 401, refresh token and retry once
    if (res.status === 401) {
      oauthToken = null
      oauthExpiry = 0
      ppToken = await authenticatePegaPlantao()
      fetchOptions.headers = {
        'Authorization': `Bearer ${ppToken}`,
        'Content-Type': 'application/json',
      }
      res = await fetch(url, fetchOptions)
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `PegaPlantao API error: ${res.status}` }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const data = await res.json()
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('pegaplantao-proxy error:', message)
    const status = message.includes('auth') || message.includes('token') || message.includes('JWT') ? 401 : 500
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
