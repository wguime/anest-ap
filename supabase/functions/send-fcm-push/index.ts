/**
 * Edge Function: send-fcm-push
 *
 * Sprint 21 Wave 2.2.
 *
 * Envia uma push notification via Firebase Cloud Messaging HTTP v1 API.
 *
 * Auth:
 *   - Authorization: Bearer — aceita JWT HS256 legado (get-supabase-token) OU
 *     Firebase ID Token (RS256), via helper compartilhado _shared/verify-auth.ts.
 *   - O caller PRECISA estar autenticado. Não há ACL admin obrigatória ainda
 *     (notificationService dispara em fan-out por user logado), mas o JWT.sub
 *     é registrado no log para auditoria.
 *
 * Env vars:
 *   - JWT_SECRET                  — para verificar o caller JWT HS256 legado
 *   - FIREBASE_PROJECT_ID         — projeto FCM destino
 *   - FCM_SERVICE_ACCOUNT_JSON    — JSON completo da service account (Google
 *                                   Cloud → IAM → Service Accounts), com
 *                                   role `Firebase Cloud Messaging API` +
 *                                   `Firebase Admin SDK`. Configurar em
 *                                   Supabase Dashboard → Edge Functions → Secrets.
 *
 * Lookup do FCM token:
 *   - Lê userProfiles/{userId}.fcmToken via Firestore REST API usando
 *     OAuth2 access token derivado da service account.
 *
 * Body:
 *   {
 *     userId?: string,       // Firebase UID do destinatário (1 pessoa)
 *     userIds?: string[],    // OU vários (lote) — ver abaixo
 *     title: string,         // notification.title
 *     body?: string,         // notification.body
 *     data?: object,         // payload custom (url, tag, etc)
 *     priority?: 'normal'|'high'
 *   }
 *
 * LOTE (2026-08-24): `userIds` existe porque o recado do plantonista vai para
 * TODA a equipe com acesso à escala — ~70 pessoas. Uma chamada por destinatário
 * significaria 70 requisições saindo do celular de quem escreveu o recado, no
 * meio do turno, cada uma pagando cold start. Aqui o OAuth do Google e a
 * service account são resolvidos UMA vez e o loop é sobre os lookups.
 * Quem não tem fcmToken (não optou por push) apenas não entra na conta — não é
 * erro: metade do grupo está nessa situação.
 *
 * Respostas:
 *   200 { messageId, sentAt }                    — push enviada (modo userId)
 *   200 { enviados, semToken, falhas, sentAt }   — modo lote (userIds)
 *   400 { error: 'invalid_payload' }             — campos faltando
 *   401 { error: 'invalid_token' }               — JWT ruim
 *   404 { error: 'no_fcm_token' }                — user não tem token (não opt-in)
 *   500 { error: 'fcm_request_failed', detail }  — FCM rejeitou
 */
import { SignJWT, importPKCS8, jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { verifyAuthHeader } from '../_shared/verify-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

interface SendPushPayload {
  userId?: string
  userIds?: string[]
  title: string
  body?: string
  data?: Record<string, string>
  priority?: 'normal' | 'high'
}

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
  token_uri: string
}

/**
 * A service_role key do projeto é um JWT HS256 assinado com JWT_SECRET, com
 * `role: 'service_role'` e SEM `sub` — por isso verifyAuthHeader a recusa.
 * O trigger notify_responsaveis_on_incidente a usa (vault + pg_net) para avisar
 * os responsáveis no celular, já que o push saiu do cliente em 04/09/2026.
 */
async function isProjectServiceRole(authHeader: string | null): Promise<boolean> {
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const secret = Deno.env.get('JWT_SECRET')
  if (!bearer || !secret) return false
  try {
    const { payload } = await jwtVerify(bearer, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Gera OAuth2 access token a partir da service account JSON.
 * Cache simples em memória (5min) — cada cold start refaz, mas warm reuses.
 */
let cachedAccessToken: { token: string; exp: number } | null = null

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.exp > Date.now() + 30_000) {
    return cachedAccessToken.token
  }

  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }

  // Service account vem com `\n` literal — normaliza para newlines reais.
  const pkcs8 = sa.private_key.replace(/\\n/g, '\n')
  const privateKey = await importPKCS8(pkcs8, 'RS256')

  const assertion = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey)

  const resp = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`google_oauth_failed: ${resp.status} ${text.slice(0, 200)}`)
  }
  const json = await resp.json() as { access_token: string; expires_in: number }
  cachedAccessToken = {
    token: json.access_token,
    exp: Date.now() + json.expires_in * 1000,
  }
  return json.access_token
}

/**
 * Consulta o fcmToken do user via Firestore REST API.
 * Path: projects/{projectId}/databases/(default)/documents/userProfiles/{userId}
 */
async function lookupFcmToken(
  accessToken: string,
  projectId: string,
  userId: string,
): Promise<string | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/userProfiles/${encodeURIComponent(userId)}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (resp.status === 404) return null
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`firestore_lookup_failed: ${resp.status} ${text.slice(0, 200)}`)
  }
  const json = await resp.json() as { fields?: Record<string, { stringValue?: string; nullValue?: unknown }> }
  const fcmField = json.fields?.fcmToken
  if (!fcmField) return null
  if ('nullValue' in fcmField) return null
  return fcmField.stringValue || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' })
  }

  // 1) Validate caller JWT (HS256 legado, Firebase ID Token RS256 OU a
  //    service_role key do projeto — o trigger de incidentes chama esta edge
  //    por pg_net e não tem sessão de usuário nenhuma (05/09/2026).
  const auth = await verifyAuthHeader(req.headers.get('authorization'))
  let callerSub: string
  if (auth.ok) {
    callerSub = auth.uid
  } else if (await isProjectServiceRole(req.headers.get('authorization'))) {
    callerSub = 'service_role'
  } else {
    // Mapeia reasons do helper para o contrato desta função:
    // internal_error (500) → server_misconfigured; missing/invalid_token mantidos.
    const error = auth.reason === 'internal_error' ? 'server_misconfigured' : auth.reason
    return jsonResponse(auth.status, { error })
  }

  // 2) Parse body.
  let payload: SendPushPayload
  try {
    payload = await req.json() as SendPushPayload
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' })
  }
  // Um destinatário OU uma lista. `MAX_LOTE` é um teto de sanidade: o grupo
  // inteiro do hospital cabe folgado em 200, e um número maior que isso é
  // sintoma de chamada errada, não de caso de uso novo.
  const MAX_LOTE = 200
  const alvos = [...new Set(
    (payload.userIds && Array.isArray(payload.userIds) ? payload.userIds : [payload.userId])
      .filter((u): u is string => typeof u === 'string' && u.length > 0),
  )].slice(0, MAX_LOTE)
  const emLote = Array.isArray(payload.userIds)
  if (alvos.length === 0 || !payload.title) {
    return jsonResponse(400, { error: 'invalid_payload' })
  }

  // 3) Service account + project.
  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'anest-ap'
  if (!saRaw) {
    console.error('send-fcm-push: FCM_SERVICE_ACCOUNT_JSON ausente')
    return jsonResponse(500, { error: 'server_misconfigured' })
  }
  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw) as ServiceAccount
  } catch (_e) {
    console.error('send-fcm-push: FCM_SERVICE_ACCOUNT_JSON JSON inválido')
    return jsonResponse(500, { error: 'server_misconfigured' })
  }

  // 4) Get Google OAuth token.
  let googleToken: string
  try {
    googleToken = await getGoogleAccessToken(sa)
  } catch (err) {
    console.error('send-fcm-push: oauth falhou', err instanceof Error ? err.message : err)
    return jsonResponse(500, { error: 'oauth_failed' })
  }

  // 5+6) Para cada alvo: lookup do fcmToken e envio. Em lote, uma falha
  // individual NÃO derruba as outras — o recado tem de chegar a quem dá.
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  const dados = payload.data
    // FCM data values precisam ser strings.
    ? Object.fromEntries(
        Object.entries(payload.data).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)]),
      )
    : undefined

  async function enviarPara(userId: string): Promise<'enviado' | 'sem_token' | 'falha'> {
    let fcmToken: string | null = null
    try {
      fcmToken = await lookupFcmToken(googleToken, projectId, userId)
    } catch (err) {
      console.error('send-fcm-push: firestore lookup', err instanceof Error ? err.message : err)
      return 'falha'
    }
    if (!fcmToken) return 'sem_token'
    const fcmBody = {
      message: {
        token: fcmToken,
        notification: { title: payload.title, body: payload.body || '' },
        data: dados,
        webpush: {
          headers: { Urgency: payload.priority === 'high' ? 'high' : 'normal' },
          fcm_options: payload.data?.url ? { link: payload.data.url } : undefined,
        },
      },
    }
    const fcmResp = await fetch(fcmEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fcmBody),
    })
    if (!fcmResp.ok) {
      const text = await fcmResp.text()
      console.error('send-fcm-push: FCM rejeitou', fcmResp.status, text.slice(0, 300))
      return 'falha'
    }
    return 'enviado'
  }

  try {
    // MODO 1 PESSOA: contrato antigo intacto (mensagens internas dependem dele),
    // inclusive o 404 de "não optou por push", que o chamador silencia.
    if (!emLote) {
      const r = await enviarPara(alvos[0])
      if (r === 'sem_token') return jsonResponse(404, { error: 'no_fcm_token' })
      if (r === 'falha') return jsonResponse(500, { error: 'fcm_request_failed' })
      const sentAt = new Date().toISOString()
      console.log('send-fcm-push: enviada', { caller: callerSub, target: alvos[0] })
      return jsonResponse(200, { messageId: null, sentAt })
    }

    // MODO LOTE: concorrência limitada. Sem o limite, 70 lookups simultâneos no
    // Firestore estouram o tempo da edge; em blocos de 10 o lote inteiro sai em
    // poucos segundos.
    const BLOCO = 10
    let enviados = 0, semToken = 0, falhas = 0
    for (let i = 0; i < alvos.length; i += BLOCO) {
      const res = await Promise.all(alvos.slice(i, i + BLOCO).map(enviarPara))
      for (const r of res) {
        if (r === 'enviado') enviados++
        else if (r === 'sem_token') semToken++
        else falhas++
      }
    }
    const sentAt = new Date().toISOString()
    console.log('send-fcm-push: lote', { caller: callerSub, alvos: alvos.length, enviados, semToken, falhas })
    return jsonResponse(200, { enviados, semToken, falhas, sentAt })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('send-fcm-push: erro inesperado', msg.slice(0, 200))
    return jsonResponse(500, { error: 'internal_error' })
  }
})
