// Wave 1.9 T1.9.4 — Edge function privada (ADMIN-ONLY) que faz backfill de um
// certificado: baixa o PDF de uma URL Firebase Storage e re-uploada para o
// bucket Supabase `certificados` em `${userId}/${certId}.pdf`.
//
// POST { certId: string, userId: string, arquivoUrl: string }
// Header: Authorization: Bearer <supabase JWT HS256 emitido por get-supabase-token>
//
// Política de autorização:
//   - JWT HS256 valido (HS256, claim `sub` = firebase_uid do caller)
//   - `sub` deve corresponder a uma linha em `admin_users.firebase_uid`
//   - SSRF guard: arquivoUrl precisa começar com firebasestorage.googleapis.com
//     ou storage.googleapis.com (apenas URLs do Firebase Storage da ANEST)
//
// Fluxo:
//   1. Valida JWT + admin gate
//   2. Valida payload (certId regex, userId regex, arquivoUrl prefix)
//   3. fetch(arquivoUrl) com AbortController timeout 10s
//   4. Upload blob no Supabase Storage `certificados/${userId}/${certId}.pdf`
//   5. Retorna 200 { ok: true, path, sizeBytes }
//
// O caller (scripts/run-backfill-pending.mjs) é responsável por atualizar o
// Firestore com supabaseMigrated:true via Firebase Admin SDK.
//
// Respostas erro:
//   400 invalid_payload                — certId/userId/arquivoUrl malformados
//   401 missing_token / invalid_jwt
//   403 forbidden_not_admin
//   405 method_not_allowed
//   500 server_error / fb_fetch_failed_<status> / supabase_upload_failed
//
// LGPD: não loga JWT, não loga arquivoUrl completa (pode conter token Firebase),
// loga apenas certId/userId opacos.

import { jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

// Regex restritivas (mesmo padrão de get-cert-download-url).
const CERT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/
const USER_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/

// SSRF guard: apenas Firebase Storage da ANEST.
const ALLOWED_URL_PREFIXES = [
  'https://firebasestorage.googleapis.com/',
  'https://storage.googleapis.com/',
]

const FB_FETCH_TIMEOUT_MS = 10_000

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'method_not_allowed' })
  }

  // Env
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const jwtSecret = Deno.env.get('JWT_SECRET')
  if (!supabaseUrl || !serviceRole || !jwtSecret) {
    console.error('backfill-cert-supabase: env ausente')
    return jsonResponse(500, { ok: false, reason: 'server_error' })
  }

  // Auth: JWT obrigatório.
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { ok: false, reason: 'missing_token' })
  }

  let callerSub = ''
  try {
    const secretKey = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(authHeader.slice(7), secretKey, {
      algorithms: ['HS256'],
    })
    callerSub = typeof payload.sub === 'string' ? payload.sub : ''
    if (!callerSub) throw new Error('sub claim ausente')
  } catch (_err) {
    return jsonResponse(401, { ok: false, reason: 'invalid_jwt' })
  }

  // Service role client — bypassa RLS (necessário para Storage write + admin_users lookup).
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Admin gate (mesmo padrão de fetch-yt-captions, generate-api-token).
  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .select('firebase_uid')
    .eq('firebase_uid', callerSub)
    .maybeSingle()
  if (adminErr) {
    console.error('backfill-cert-supabase: admin lookup error', adminErr.message)
    return jsonResponse(500, { ok: false, reason: 'server_error' })
  }
  if (!adminRow) {
    console.log('backfill-cert-supabase: forbidden_not_admin', { sub: callerSub })
    return jsonResponse(403, { ok: false, reason: 'forbidden_not_admin' })
  }

  // Payload
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const certId = typeof body.certId === 'string' ? body.certId : ''
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const arquivoUrl = typeof body.arquivoUrl === 'string' ? body.arquivoUrl : ''

  if (!CERT_ID_REGEX.test(certId)) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }
  if (!USER_ID_REGEX.test(userId)) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }
  // SSRF guard
  if (!ALLOWED_URL_PREFIXES.some((p) => arquivoUrl.startsWith(p))) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  // 1. Fetch Firebase
  let pdfBlob: Blob
  let sizeBytes = 0
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), FB_FETCH_TIMEOUT_MS)
    let fbResp: Response
    try {
      fbResp = await fetch(arquivoUrl, { signal: ctrl.signal })
    } finally {
      clearTimeout(timeout)
    }
    if (!fbResp.ok) {
      console.error(`backfill-cert-supabase: fb_fetch_failed status=${fbResp.status} certId=${certId}`)
      return jsonResponse(500, { ok: false, reason: `fb_fetch_failed_${fbResp.status}` })
    }
    pdfBlob = await fbResp.blob()
    sizeBytes = pdfBlob.size
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('backfill-cert-supabase: fb_fetch exception', msg.slice(0, 200), 'certId=', certId)
    return jsonResponse(500, { ok: false, reason: 'fb_fetch_failed' })
  }

  // 2. Upload Supabase
  const path = `${userId}/${certId}.pdf`
  try {
    const { error: upErr } = await supabase.storage
      .from('certificados')
      .upload(path, pdfBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })
    if (upErr) {
      console.error('backfill-cert-supabase: supabase_upload_failed', upErr.message, 'certId=', certId)
      return jsonResponse(500, { ok: false, reason: 'supabase_upload_failed' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('backfill-cert-supabase: upload exception', msg.slice(0, 200), 'certId=', certId)
    return jsonResponse(500, { ok: false, reason: 'supabase_upload_failed' })
  }

  return jsonResponse(200, {
    ok: true,
    path,
    sizeBytes,
  })
})
