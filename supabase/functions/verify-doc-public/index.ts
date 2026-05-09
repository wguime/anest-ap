// Sprint 10 / F7 — Portal público /verificar/doc/:hash.
//
// GET ?hash=<sha256>
//
// Verifica integridade de documento institucional pelo SHA-256 do PDF
// assinado. Sem autenticação (público por design — verificação por
// terceiros). Rate limit 60 req/min/IP via tabela documento_api_rate_limit.
//
// Resposta de sucesso (200):
//   { ok: true, codigo, titulo, versao, decidedAt, signatureHash, signatureAlgo }
//
// Resposta erro:
//   404 { ok: false, reason: 'not_found' }      — hash não bate ou doc não público
//   400 { ok: false, reason: 'invalid_hash' }   — formato hash inválido
//   429 { ok: false, reason: 'rate_limited' }   — IP excedeu 60/min
//   500 { ok: false, reason: 'internal_error' }
//
// LGPD: não retorna PII. campos de prova de integridade apenas.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    // x-forwarded-for é "client, proxy1, proxy2" — primeiro é o cliente real
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'GET') {
    return jsonResponse(405, { ok: false, reason: 'method_not_allowed' })
  }

  const url = new URL(req.url)
  const hash = url.searchParams.get('hash')
  if (!hash) {
    return jsonResponse(400, { ok: false, reason: 'missing_hash' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    console.error('verify-doc-public: env não configurado')
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }

  const ip = clientIp(req)

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_verify_document_public`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_hash: hash, p_ip: ip }),
    })

    const text = await rpcRes.text()
    let parsed: unknown = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }

    if (!rpcRes.ok) {
      // Postgres exception com message 'rate_limited' ou 'invalid_hash'
      const msg =
        (parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : '') || ''

      if (msg.includes('rate_limited')) {
        return jsonResponse(429, { ok: false, reason: 'rate_limited' })
      }
      if (msg.includes('invalid_hash')) {
        return jsonResponse(400, { ok: false, reason: 'invalid_hash' })
      }

      console.error('verify-doc-public: RPC error', rpcRes.status, msg.slice(0, 200))
      return jsonResponse(500, { ok: false, reason: 'internal_error' })
    }

    const rows = Array.isArray(parsed) ? parsed : []
    if (rows.length === 0) {
      return jsonResponse(404, { ok: false, reason: 'not_found' })
    }

    const row = rows[0] as {
      codigo: string
      titulo: string
      versao: number
      decided_at: string | null
      signature_hash: string
      signature_algo: string
    }

    return jsonResponse(200, {
      ok: true,
      codigo: row.codigo,
      titulo: row.titulo,
      versao: row.versao,
      decidedAt: row.decided_at,
      signatureHash: row.signature_hash,
      signatureAlgo: row.signature_algo,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('verify-doc-public: fetch error', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }
})
