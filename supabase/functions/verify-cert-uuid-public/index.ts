/**
 * Edge Function: verify-cert-uuid-public
 *
 * Wave 1.7 (LGPD hardening).
 *
 * Endpoint público para verificação de certificado por UUID (ex.: /verificar/:uuid).
 * Substitui a leitura client-side direta de `educacao_certificados/{uuid}` no
 * Firestore — que expunha `userNome` (nome completo) na UI pública, violando
 * princípio de minimização da LGPD.
 *
 * Esta function:
 *   1. Recebe `GET /verify-cert-uuid-public?uuid=<id>` (sem JWT).
 *   2. Aplica rate-limit 60 req/min/IP via RPC SECURITY DEFINER.
 *   3. Valida formato do UUID por regex (defesa contra path traversal/SSRF).
 *   4. Faz lookup do doc em Firestore via REST API usando OAuth2 da
 *      service account (FCM_SERVICE_ACCOUNT_JSON — reusada do send-fcm-push).
 *   5. Devolve apenas campos LGPD-safe + INICIAIS do titular (G.G.G.).
 *      NUNCA: userNome completo, userId, userEmail, assinaturaHMAC.
 *
 * Env vars:
 *   - SUPABASE_URL                — para chamar a RPC de rate limit
 *   - SUPABASE_SERVICE_ROLE_KEY   — auth da RPC (a tabela tem RLS)
 *   - FIREBASE_PROJECT_ID         — projeto Firestore (default anest-ap)
 *   - FCM_SERVICE_ACCOUNT_JSON    — service account JSON (já existe em prod
 *                                   para send-fcm-push, reusa). Precisa de
 *                                   role "Cloud Datastore User" para ler
 *                                   educacao_certificados via Firestore REST.
 *
 * Respostas:
 *   200 { valid: true, status, cursoTitulo, cargaHoraria, dataEmissao, validoAte,
 *         iniciais, signatureVersion }
 *   200 { valid: false, reason: 'not_found' }     — UUID não existe (200 p/
 *                                                    UI tratar como negative
 *                                                    answer; não vaza 404
 *                                                    detail)
 *   400 { valid: false, reason: 'invalid_uuid' }  — formato inválido
 *   429 { valid: false, reason: 'rate_limited' }  — IP excedeu 60/min
 *   500 { valid: false, reason: 'internal_error' }— config ausente / falha REST
 *
 * LGPD: ZERO PII identificável no response. Iniciais com pontos são
 * informativas (titular se reconhece) mas não permitem reidentificação
 * por terceiros sem outro vetor.
 */

import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

// UUID dos certificados em ANEST hoje tem formato `${userId}_${cursoId}` ou
// `${userId}_trilha_${trilhaId}`. Aceita alfanumérico + _ - dentro de 5..200 chars.
const CERT_UUID_REGEX = /^[a-zA-Z0-9_-]{5,200}$/

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
  token_uri: string
}

interface CertResponseSuccess {
  valid: true
  status: 'valido' | 'expirado' | 'revogado'
  cursoTitulo: string | null
  cargaHoraria: string | null
  dataEmissao: string | null
  validoAte: string | null
  iniciais: string
  signatureVersion: number | null
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Gera iniciais "G.G.G." a partir do nome completo. Retorna 'A.' se
 * não conseguir extrair (proteção fail-safe).
 */
function buildIniciais(nomeCompleto: unknown): string {
  if (typeof nomeCompleto !== 'string' || !nomeCompleto.trim()) return 'A.'
  return nomeCompleto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}.`)
    .join('')
}

/**
 * OAuth2 access token a partir da service account JSON. Cache 5min.
 * Espelha o padrão de send-fcm-push (mesma SA, scopes diferentes).
 */
let cachedAccessToken: { token: string; exp: number } | null = null

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.exp > Date.now() + 30_000) {
    return cachedAccessToken.token
  }
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: sa.client_email,
    // Apenas datastore (Firestore). Não pedimos messaging (princípio do menor privilégio).
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }
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
  const json = (await resp.json()) as { access_token: string; expires_in: number }
  cachedAccessToken = {
    token: json.access_token,
    exp: Date.now() + json.expires_in * 1000,
  }
  return json.access_token
}

/**
 * Extrai um valor primitivo de Firestore REST API field encoding.
 * Suporta: stringValue, integerValue, doubleValue, booleanValue, timestampValue.
 * Retorna null para tipos não suportados (mapValue, arrayValue, etc).
 */
function unwrapFirestoreField(field: unknown): unknown {
  if (!field || typeof field !== 'object') return null
  const f = field as Record<string, unknown>
  if ('stringValue' in f) return f.stringValue
  if ('integerValue' in f) return Number(f.integerValue)
  if ('doubleValue' in f) return Number(f.doubleValue)
  if ('booleanValue' in f) return f.booleanValue
  if ('timestampValue' in f) return f.timestampValue
  if ('nullValue' in f) return null
  return null
}

/**
 * Lê o doc educacao_certificados/{uuid} via Firestore REST API.
 * Retorna o `fields` mapeado para shape JS-friendly ou null se 404.
 */
async function lookupCertificado(
  accessToken: string,
  projectId: string,
  uuid: string,
): Promise<Record<string, unknown> | null> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)` +
    `/documents/educacao_certificados/${encodeURIComponent(uuid)}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (resp.status === 404) return null
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`firestore_lookup_failed: ${resp.status} ${text.slice(0, 200)}`)
  }
  const json = (await resp.json()) as {
    fields?: Record<string, unknown>
  }
  if (!json.fields) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(json.fields)) {
    out[k] = unwrapFirestoreField(v)
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(405, { valid: false, reason: 'method_not_allowed' })
  }

  // Extrai UUID — querystring (GET) ou body (POST).
  let uuid = ''
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      uuid = url.searchParams.get('uuid') || ''
    } else {
      const body = (await req.json().catch(() => ({}))) as { uuid?: unknown }
      uuid = typeof body.uuid === 'string' ? body.uuid : ''
    }
  } catch {
    return jsonResponse(400, { valid: false, reason: 'invalid_uuid' })
  }

  if (!uuid || !CERT_UUID_REGEX.test(uuid)) {
    return jsonResponse(400, { valid: false, reason: 'invalid_uuid' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) {
    console.error('verify-cert-uuid-public: SUPABASE env ausente')
    return jsonResponse(500, { valid: false, reason: 'internal_error' })
  }

  // Rate limit ANTES de qualquer trabalho caro (Firestore lookup, OAuth).
  const ip = clientIp(req)
  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_check_cert_uuid_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: ip }),
    })
    if (!rpcRes.ok) {
      const text = await rpcRes.text()
      if (text.includes('rate_limited')) {
        return jsonResponse(429, { valid: false, reason: 'rate_limited' })
      }
      console.error('verify-cert-uuid-public: rate-limit RPC fail', rpcRes.status, text.slice(0, 200))
      return jsonResponse(500, { valid: false, reason: 'internal_error' })
    }
  } catch (err) {
    console.error('verify-cert-uuid-public: rate-limit network fail', err instanceof Error ? err.message : err)
    return jsonResponse(500, { valid: false, reason: 'internal_error' })
  }

  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'anest-ap'
  if (!saRaw) {
    console.error('verify-cert-uuid-public: FCM_SERVICE_ACCOUNT_JSON ausente')
    return jsonResponse(500, { valid: false, reason: 'internal_error' })
  }
  let sa: ServiceAccount
  try {
    sa = JSON.parse(saRaw) as ServiceAccount
  } catch {
    console.error('verify-cert-uuid-public: SA JSON inválido')
    return jsonResponse(500, { valid: false, reason: 'internal_error' })
  }

  let googleToken: string
  try {
    googleToken = await getGoogleAccessToken(sa)
  } catch (err) {
    console.error('verify-cert-uuid-public: oauth falhou', err instanceof Error ? err.message : err)
    return jsonResponse(500, { valid: false, reason: 'internal_error' })
  }

  let cert: Record<string, unknown> | null
  try {
    cert = await lookupCertificado(googleToken, projectId, uuid)
  } catch (err) {
    console.error('verify-cert-uuid-public: firestore lookup', err instanceof Error ? err.message : err)
    return jsonResponse(500, { valid: false, reason: 'internal_error' })
  }

  if (!cert) {
    return jsonResponse(200, { valid: false, reason: 'not_found' })
  }

  // Determina status: revogado > expirado > valido.
  const rawStatus = typeof cert.status === 'string' ? cert.status : ''
  const validoAteIso = typeof cert.validoAte === 'string' ? cert.validoAte : null
  let status: CertResponseSuccess['status'] = 'valido'
  if (rawStatus === 'revogado') {
    status = 'revogado'
  } else if (validoAteIso) {
    const validoAteMs = Date.parse(validoAteIso)
    if (!Number.isNaN(validoAteMs) && validoAteMs < Date.now()) {
      status = 'expirado'
    }
  }

  const response: CertResponseSuccess = {
    valid: true,
    status,
    cursoTitulo: typeof cert.cursoTitulo === 'string' ? cert.cursoTitulo : null,
    cargaHoraria:
      typeof cert.cargaHoraria === 'string'
        ? cert.cargaHoraria
        : typeof cert.cargaHoraria === 'number'
          ? String(cert.cargaHoraria)
          : null,
    dataEmissao: typeof cert.dataEmissao === 'string' ? cert.dataEmissao : null,
    validoAte: validoAteIso,
    iniciais: buildIniciais(cert.userNome),
    signatureVersion:
      typeof cert.signatureVersion === 'number'
        ? cert.signatureVersion
        : null,
  }

  return jsonResponse(200, response)
})
