import { jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://anest-ap.web.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

async function verifySupabaseJwt(authHeader: string) {
  const jwtSecret = Deno.env.get('JWT_SECRET')
  if (!jwtSecret) throw new Error('JWT_SECRET not configured')

  const token = authHeader.replace('Bearer ', '')
  const secretKey = new TextEncoder().encode(jwtSecret)
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] })
  return payload
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller's JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    await verifySupabaseJwt(authHeader)

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
