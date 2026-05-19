// Wave 1.8 — Edge function privada que emite signed URL de download para
// certificados em Supabase Storage (bucket `certificados`).
//
// POST { certificadoId }
// Header: Authorization: Bearer <supabase JWT HS256>
//
// Política de autorização: o path do objeto começa com auth.sub (firebase_uid),
// portanto a Edge tenta ler `${userId}/${certificadoId}.pdf` e gera signed URL
// com TTL=300s. Service-role bypassa RLS (necessário porque o bucket é privado
// e o cliente não tem permissão direta para createSignedUrl).
//
// Resposta sucesso (200):
//   { ok: true, signedUrl: string, expiresAt: ISOString, ttlSeconds: 300 }
//
// Respostas erro:
//   400 { ok: false, reason: 'invalid_payload' }   — certificadoId faltando/inválido
//   401 { ok: false, reason: 'missing_token' }     — sem Authorization
//   401 { ok: false, reason: 'invalid_jwt' }       — JWT inválido/expirado
//   404 { ok: false, reason: 'not_found' }         — arquivo não existe no bucket
//   405 { ok: false, reason: 'method_not_allowed' }
//   500 { ok: false, reason: 'server_error' }      — env faltando ou storage erro
//
// LGPD: não loga JWT, não loga signedUrl, não persiste payload. userId é
// identificador opaco (Firebase UID).

import { jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

// TTL 5min: minimização LGPD — URL é de uso único (cliente abre imediatamente
// via window.open), expira antes de cair em logs HTTP/proxy/clipboard share.
const TTL_SECONDS = 300
// Max 128 chars: previne probing/log-flood. CertIds reais têm formato
// `${userId}_trilha_${trilhaId}` ou `${userId}_${cursoId}` — bem abaixo do limite.
const CERT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/

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
    console.error('get-cert-download-url: env ausente')
    return jsonResponse(500, { ok: false, reason: 'server_error' })
  }

  // Auth: JWT obrigatório (HS256 emitido por get-supabase-token).
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { ok: false, reason: 'missing_token' })
  }

  let userId = ''
  try {
    const secretKey = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(authHeader.slice(7), secretKey, {
      algorithms: ['HS256'],
    })
    userId = typeof payload.sub === 'string' ? payload.sub : ''
    if (!userId) throw new Error('sub claim ausente')
  } catch (_err) {
    return jsonResponse(401, { ok: false, reason: 'invalid_jwt' })
  }

  // Payload
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const certificadoId = typeof body.certificadoId === 'string' ? body.certificadoId : ''
  // Anti path traversal: regex restritiva (Firestore IDs são [a-zA-Z0-9_-]+).
  if (!certificadoId || !CERT_ID_REGEX.test(certificadoId)) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const path = `${userId}/${certificadoId}.pdf`

  // Service role client — bypassa RLS (necessário para createSignedUrl em bucket privado).
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verifica existência via list (search). Path traversal bloqueado pelo regex acima
  // e pela folder enumeration apenas no folder do user.
  try {
    const { data: files, error: listErr } = await supabase.storage
      .from('certificados')
      .list(userId, { search: `${certificadoId}.pdf`, limit: 1 })

    if (listErr) {
      console.error('get-cert-download-url: list error', listErr.message)
      return jsonResponse(500, { ok: false, reason: 'server_error' })
    }
    if (!files || files.length === 0) {
      return jsonResponse(404, { ok: false, reason: 'not_found' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('get-cert-download-url: list exception', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'server_error' })
  }

  // Gera signed URL.
  try {
    const { data, error: signErr } = await supabase.storage
      .from('certificados')
      .createSignedUrl(path, TTL_SECONDS)

    if (signErr || !data?.signedUrl) {
      console.error('get-cert-download-url: sign error', signErr?.message || 'no url')
      return jsonResponse(500, { ok: false, reason: 'server_error' })
    }

    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString()

    // Wave 1.9 T1.9.6 + hotfix security MED-2: audit trail server-side com IP minimizado
    // (apenas /16 para IPv4, /48 para IPv6) — retenção 5 anos exige minimização LGPD.
    try {
      const rawIp = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '')
        .split(',')[0]
        .trim()
        .slice(0, 64)
      let ipPrefix: string | null = null
      if (rawIp) {
        if (rawIp.includes('.')) {
          // IPv4: keep /16 (ex: 192.168.0.0)
          const parts = rawIp.split('.')
          if (parts.length === 4) ipPrefix = `${parts[0]}.${parts[1]}.0.0`
        } else if (rawIp.includes(':')) {
          // IPv6: keep /48 (3 hextets)
          const parts = rawIp.split(':')
          ipPrefix = `${parts.slice(0, 3).join(':')}::`
        }
      }
      await supabase.from('educacao_downloads_audit').insert({
        user_id: userId,
        action: 'cert_download_signed',
        target_type: 'educacao_certificado',
        target_id: certificadoId,
        metadata: {
          ttl_seconds: TTL_SECONDS,
          ip_prefix: ipPrefix, // minimizado: /16 IPv4 ou /48 IPv6
          user_agent: (req.headers.get('user-agent') || '').slice(0, 200) || null,
        },
      })
    } catch (auditErr) {
      const auditMsg = auditErr instanceof Error ? auditErr.message : String(auditErr)
      // LGPD_AUDIT_DROPPED tag: facilita log-scraping para alertar quedas de audit
      console.error('get-cert-download-url: LGPD_AUDIT_DROPPED:', auditMsg.slice(0, 200))
      // best-effort: NÃO bloquear download
    }

    return jsonResponse(200, {
      ok: true,
      signedUrl: data.signedUrl,
      expiresAt,
      ttlSeconds: TTL_SECONDS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('get-cert-download-url: sign exception', msg.slice(0, 200))
    return jsonResponse(500, { ok: false, reason: 'server_error' })
  }
})
