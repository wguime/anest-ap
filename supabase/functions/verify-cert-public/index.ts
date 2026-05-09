// Sprint 11 — Edge function pública de verificação HMAC de certificado de educação.
//
// POST { userId, cursoId, dataEmissaoISO, assinaturaHMAC }
//
// Antes do refactor o HMAC era calculado client-side em educacaoService.js
// com secret hardcoded no bundle (security debt). Agora o secret vive
// apenas em Deno.env.get('CERT_HMAC_SECRET') e é inacessível ao cliente.
// O cliente envia os campos do certificado + a assinatura armazenada e a
// edge confirma se bate.
//
// Resposta de sucesso (200):
//   { ok: true, valid: boolean }
//
// Resposta erro:
//   400 { ok: false, reason: 'invalid_payload' }   — campos faltando
//   429 { ok: false, reason: 'rate_limited' }      — IP excedeu 60/min
//   500 { ok: false, reason: 'internal_error' }    — env não configurado etc
//
// LGPD: a edge não persiste nem retorna PII. Recebe e descarta.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

function isHexSig(s: unknown): s is string {
  return typeof s === 'string' && /^[a-f0-9]{64}$/.test(s)
}

async function computeHmac(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Comparação tempo-constante para mitigar timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'method_not_allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const certSecret = Deno.env.get('CERT_HMAC_SECRET')
  if (!supabaseUrl || !serviceRole || !certSecret) {
    console.error('verify-cert-public: env não configurado')
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const userId = typeof body.userId === 'string' ? body.userId : ''
  const cursoId = typeof body.cursoId === 'string' ? body.cursoId : ''
  const dataEmissaoISO = typeof body.dataEmissaoISO === 'string' ? body.dataEmissaoISO : ''
  const assinatura = body.assinaturaHMAC

  if (!userId || !cursoId || !isHexSig(assinatura)) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const ip = clientIp(req)

  // Rate limit antes de gastar CPU em HMAC
  try {
    const rlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_check_cert_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: ip }),
    })
    if (!rlRes.ok) {
      const text = await rlRes.text()
      let parsed: unknown = null
      try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }
      const msg = (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : '') || ''
      if (msg.includes('rate_limited')) {
        return jsonResponse(429, { ok: false, reason: 'rate_limited' })
      }
      console.error('verify-cert-public: rate limit RPC error', rlRes.status, msg.slice(0, 200))
      return jsonResponse(500, { ok: false, reason: 'internal_error' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('verify-cert-public: rate limit fetch error', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }

  try {
    const payload = `${userId}|${cursoId}|${dataEmissaoISO}`
    const expected = await computeHmac(certSecret, payload)
    const valid = constantTimeEqual(expected, assinatura)
    return jsonResponse(200, { ok: true, valid })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('verify-cert-public: hmac error', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }
})
