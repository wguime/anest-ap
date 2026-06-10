// Sprint 12 — Edge function privada que emite assinatura HMAC para
// certificados de educação. O secret de assinatura (CERT_HMAC_SECRET_V2)
// vive apenas em Deno.env e não é exposto ao cliente.
//
// POST { userId, cursoId, dataEmissaoISO }
// Header: Authorization: Bearer <JWT HS256 legado OU Firebase ID Token (RS256)>
//
// Política de autorização: o JWT.sub PRECISA bater com o userId do payload.
// Não há override admin nesta versão — o fluxo atual é "user conclui curso
// → app emite cert para ele mesmo". Se um admin precisar emitir para outro
// user, será trabalho separado (workflow admin distinto).
//
// Resposta de sucesso (200):
//   { ok: true, assinaturaHMAC: string, signatureVersion: 2 }
//
// Respostas erro:
//   400 { ok: false, reason: 'invalid_payload' }       — campos faltando
//   401 { ok: false, reason: 'missing_token' }         — sem header
//   401 { ok: false, reason: 'invalid_token' }         — JWT inválido/expirado
//   403 { ok: false, reason: 'forbidden_user_mismatch' } — JWT.sub ≠ userId
//   500 { ok: false, reason: 'internal_error' }        — JWT_SECRET ausente
//   500 { ok: false, reason: 'secret_unavailable' }    — CERT_HMAC_SECRET_V2 ausente
//
// LGPD: a edge não persiste nem retorna PII além do que recebe. userId é
// um identificador opaco (Firebase UID).

import { verifyAuthHeader } from '../_shared/verify-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const SIGNATURE_VERSION = 2

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'method_not_allowed' })
  }

  // Auth: JWT obrigatório (HS256 legado de get-supabase-token OU Firebase
  // ID Token RS256) — verificação compartilhada em _shared/verify-auth.ts.
  // Os reasons/status do helper coincidem 1:1 com o contrato desta função
  // (401 missing_token | 401 invalid_token | 500 internal_error).
  const auth = await verifyAuthHeader(req.headers.get('authorization'))
  if (!auth.ok) {
    return jsonResponse(auth.status, { ok: false, reason: auth.reason })
  }
  const jwtSub = auth.uid

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const userId = typeof body.userId === 'string' ? body.userId : ''
  const cursoId = typeof body.cursoId === 'string' ? body.cursoId : ''
  const dataEmissaoISO = typeof body.dataEmissaoISO === 'string' ? body.dataEmissaoISO : ''

  if (!userId || !cursoId || !dataEmissaoISO) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  // Política: só posso assinar cert para o user dono do JWT.
  if (userId !== jwtSub) {
    return jsonResponse(403, { ok: false, reason: 'forbidden_user_mismatch' })
  }

  const certSecret = Deno.env.get('CERT_HMAC_SECRET_V2')
  if (!certSecret) {
    console.error('sign-cert: CERT_HMAC_SECRET_V2 ausente')
    return jsonResponse(500, { ok: false, reason: 'secret_unavailable' })
  }

  try {
    const payload = `${userId}|${cursoId}|${dataEmissaoISO}`
    const assinaturaHMAC = await computeHmac(certSecret, payload)
    return jsonResponse(200, {
      ok: true,
      assinaturaHMAC,
      signatureVersion: SIGNATURE_VERSION,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('sign-cert: hmac error', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }
})
