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

// ── Guardrails de ESCRITA (2026-08-04) ──────────────────────────────────────
// O proxy sempre repassou method/body crus, mas NUNCA foi exercitado com
// não-GET. Antes de qualquer escrita no Pega Plantão (marcação de férias),
// três travas: (1) allowlist explícita — endpoint+método fora dela = 405;
// (2) o retry automático de 401 vale só p/ GET (re-executar um POST duplica
// a marcação: a API não tem idempotency key); (3) o corpo do erro upstream
// é repassado (sem ele, descobrir a API de escrita é voar cego).
// SONDA DE 04/08 CONCLUÍDA — allowlist fechada de novo. Resultado:
//  · POST /api/v1/plantoes FUNCIONA (campos: Setor=guid, Tipo='Férias',
//    Inicio, Fim) mas cria a vaga SEM profissional (CodigoProfissional
//    null): a API não aceita o nome e /profissionais/lista devolve vazio,
//    então não há como dizer DE QUEM é a férias;
//  · DELETE /api/v1/plantoes/{cod} → 403 "Usuário sem permissão para
//    remover plantões" — desmarcar seria impossível;
//  · o que o POST cria não volta no GET /plantoes (vaga sem profissional
//    não é listada), ou seja, nem o extrato veria.
// Conclusão: escrita no PP inviável com a credencial atual. Reabrir só se
// o Pega Plantão liberar permissão de remoção + o código do profissional.
const WRITE_ALLOWLIST: Array<{ method: string; pattern: RegExp }> = []

function escritaPermitida(method: string, endpoint: string): boolean {
  return WRITE_ALLOWLIST.some(
    (regra) => regra.method === method.toUpperCase() && regra.pattern.test(endpoint),
  )
}

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

    // Escrita só pela allowlist (ver WRITE_ALLOWLIST no topo)
    if (method.toUpperCase() !== 'GET' && !escritaPermitida(method, endpoint)) {
      return new Response(
        JSON.stringify({ error: `Método ${method} não permitido pelo proxy para ${endpoint}` }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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

    // Se 401, renova o token e tenta de novo — SÓ em GET (repetir uma
    // escrita sem idempotency key duplicaria a marcação no Pega Plantão)
    if (res.status === 401 && method.toUpperCase() === 'GET') {
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
      // Repassa o corpo do upstream: numa escrita é ele que traz a razão
      // da recusa (vaga cheia, prazo, campo faltando)
      const upstream = await res.text().catch(() => '')
      return new Response(
        JSON.stringify({
          error: `PegaPlantao API error: ${res.status}`,
          ...(upstream ? { upstream: upstream.slice(0, 2000) } : {}),
        }),
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
