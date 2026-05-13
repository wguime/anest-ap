/**
 * Edge Function: send-fcm-push
 *
 * Sprint 21 Wave 2.2.
 *
 * Envia uma push notification via Firebase Cloud Messaging HTTP v1 API.
 *
 * Auth:
 *   - Authorization: Bearer <Supabase JWT HS256> emitido pelo get-supabase-token.
 *   - O caller PRECISA estar autenticado. Não há ACL admin obrigatória ainda
 *     (notificationService dispara em fan-out por user logado), mas o JWT.sub
 *     é registrado no log para auditoria.
 *
 * Env vars:
 *   - JWT_SECRET                  — para verificar o caller JWT
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
 *     userId: string,        // Firebase UID do destinatário
 *     title: string,         // notification.title
 *     body?: string,         // notification.body
 *     data?: object,         // payload custom (url, tag, etc)
 *     priority?: 'normal'|'high'
 *   }
 *
 * Respostas:
 *   200 { messageId, sentAt }                    — push enviada
 *   400 { error: 'invalid_payload' }             — campos faltando
 *   401 { error: 'invalid_token' }               — JWT ruim
 *   404 { error: 'no_fcm_token' }                — user não tem token (não opt-in)
 *   500 { error: 'fcm_request_failed', detail }  — FCM rejeitou
 */
import { jwtVerify, SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

interface SendPushPayload {
  userId: string
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

  // 1) Validate caller JWT.
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'missing_token' })
  }
  const jwtSecret = Deno.env.get('JWT_SECRET')
  if (!jwtSecret) {
    console.error('send-fcm-push: JWT_SECRET ausente')
    return jsonResponse(500, { error: 'server_misconfigured' })
  }
  let callerSub = ''
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), new TextEncoder().encode(jwtSecret), {
      algorithms: ['HS256'],
    })
    callerSub = typeof payload.sub === 'string' ? payload.sub : ''
    if (!callerSub) throw new Error('sub missing')
  } catch (_err) {
    return jsonResponse(401, { error: 'invalid_token' })
  }

  // 2) Parse body.
  let payload: SendPushPayload
  try {
    payload = await req.json() as SendPushPayload
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' })
  }
  if (!payload.userId || !payload.title) {
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

  // 5) Lookup FCM token from Firestore.
  let fcmToken: string | null = null
  try {
    fcmToken = await lookupFcmToken(googleToken, projectId, payload.userId)
  } catch (err) {
    console.error('send-fcm-push: firestore lookup', err instanceof Error ? err.message : err)
    return jsonResponse(500, { error: 'firestore_lookup_failed' })
  }
  if (!fcmToken) {
    return jsonResponse(404, { error: 'no_fcm_token' })
  }

  // 6) Send FCM HTTP v1.
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  const fcmBody = {
    message: {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body || '',
      },
      data: payload.data
        // FCM data values precisam ser strings.
        ? Object.fromEntries(
            Object.entries(payload.data).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)]),
          )
        : undefined,
      webpush: {
        headers: {
          Urgency: payload.priority === 'high' ? 'high' : 'normal',
        },
        fcm_options: payload.data?.url ? { link: payload.data.url } : undefined,
      },
    },
  }

  try {
    const fcmResp = await fetch(fcmEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmBody),
    })

    if (!fcmResp.ok) {
      const text = await fcmResp.text()
      console.error('send-fcm-push: FCM rejeitou', fcmResp.status, text.slice(0, 300))
      return jsonResponse(500, { error: 'fcm_request_failed', detail: text.slice(0, 200) })
    }

    const fcmJson = await fcmResp.json() as { name?: string }
    const messageId = fcmJson.name || null
    const sentAt = new Date().toISOString()
    console.log('send-fcm-push: enviada', { caller: callerSub, target: payload.userId, messageId })
    return jsonResponse(200, { messageId, sentAt })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('send-fcm-push: erro inesperado', msg.slice(0, 200))
    return jsonResponse(500, { error: 'internal_error' })
  }
})
