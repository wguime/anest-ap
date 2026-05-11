// Sprint 11 — Edge function pública de verificação HMAC de certificado de educação.
// Sprint 12 — versionamento de assinatura (signatureVersion 1 ou 2), com fallback V1.
// Sprint 13 — fallback V1 removido. Só `signatureVersion: 2` é aceito.
//
// POST { userId, cursoId, dataEmissaoISO, assinaturaHMAC, signatureVersion? }
//
// signatureVersion ausente → default = 2.
// signatureVersion = 2 → usa CERT_HMAC_SECRET_V2.
// signatureVersion = 1 (ou qualquer outro valor) → 400 invalid_payload (fail-closed).
//
// Histórico:
//   - Pré-Sprint 11: HMAC calculado client-side com secret hardcoded no bundle
//     (security debt). Esse secret vazou em git history e foi rotacionado.
//   - Sprint 11: secret movido para Deno.env (CERT_HMAC_SECRET). Verify-only.
//   - Sprint 12: introduzida cadeia V2 (CERT_HMAC_SECRET_V2 + edge sign-cert
//     JWT-gated) e mantido fallback V1 transitório.
//   - Sprint 13: confirmado via query Firestore que ZERO certs ativos usam V1.
//     Fallback V1 removido; CERT_HMAC_SECRET (legacy) revogado no Supabase.
//
// Resposta de sucesso (200):
//   { ok: true, valid: boolean, signatureVersion: 2 }
//
// Resposta erro:
//   400 { ok: false, reason: 'invalid_payload' }     — campos faltando ou versão != 2
//   429 { ok: false, reason: 'rate_limited' }        — IP excedeu 60/min
//   500 { ok: false, reason: 'internal_error' }      — env não configurado etc
//   500 { ok: false, reason: 'version_unavailable' } — CERT_HMAC_SECRET_V2 ausente
//
// LGPD: a edge não persiste nem retorna PII. Recebe e descarta.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const SUPPORTED_SIGNATURE_VERSION = 2

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
  if (!supabaseUrl || !serviceRole) {
    console.error('verify-cert-public: env supabase não configurado')
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
  // Sprint 13: só V2 é aceita. Ausência defaulta para V2.
  const rawVersion = body.signatureVersion
  const signatureVersion = rawVersion === undefined || rawVersion === null
    ? SUPPORTED_SIGNATURE_VERSION
    : rawVersion

  if (
    !userId ||
    !cursoId ||
    !isHexSig(assinatura) ||
    signatureVersion !== SUPPORTED_SIGNATURE_VERSION
  ) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const certSecret = Deno.env.get('CERT_HMAC_SECRET_V2')
  if (!certSecret) {
    console.error('verify-cert-public: CERT_HMAC_SECRET_V2 ausente')
    return jsonResponse(500, { ok: false, reason: 'version_unavailable' })
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
    return jsonResponse(200, { ok: true, valid, signatureVersion: SUPPORTED_SIGNATURE_VERSION })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('verify-cert-public: hmac error', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }
})
