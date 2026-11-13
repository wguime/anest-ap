// =============================================================================
// supabase/functions/api-v1/_firestore.ts — leitura do Firestore pelo servidor
//
// OAuth2 da service account (mesmo padrão de send-fcm-push), escopo SÓ
// `datastore`, e helpers de leitura pela REST API que convertem os `fields`
// tipados (stringValue, mapValue, ...) em JS comum.
//
// Secret: FCM_SERVICE_ACCOUNT_JSON (JSON da service account). Nunca logar o
// valor nem o token — os erros carregam só status HTTP e um trecho da resposta.
// Projeto: FIREBASE_PROJECT_ID || 'anest-ap'.
// =============================================================================

import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts'

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
}

const ESCOPO = 'https://www.googleapis.com/auth/datastore'
const LOTE_BATCH_GET = 100

let tokenEmCache: { token: string; exp: number } | null = null

function projeto(): string {
  return Deno.env.get('FIREBASE_PROJECT_ID') || 'anest-ap'
}

function raizDocumentos(): string {
  return `projects/${projeto()}/databases/(default)/documents`
}

async function tokenGoogle(): Promise<string> {
  if (tokenEmCache && tokenEmCache.exp > Date.now() + 30_000) return tokenEmCache.token

  const bruto = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!bruto) throw new Error('firestore_nao_configurado: FCM_SERVICE_ACCOUNT_JSON ausente')
  let sa: ServiceAccount
  try {
    sa = JSON.parse(bruto) as ServiceAccount
  } catch {
    throw new Error('firestore_nao_configurado: FCM_SERVICE_ACCOUNT_JSON inválido')
  }

  const agora = Math.floor(Date.now() / 1000)
  const chave = await importPKCS8(sa.private_key.replace(/\\n/g, '\n'), 'RS256')
  const assertion = await new SignJWT({
    iss: sa.client_email,
    scope: ESCOPO,
    aud: sa.token_uri,
    iat: agora,
    exp: agora + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(chave)

  const resp = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!resp.ok) throw new Error(`google_oauth_falhou: ${resp.status}`)
  const json = (await resp.json()) as { access_token: string; expires_in: number }
  tokenEmCache = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 }
  return json.access_token
}

// ── Conversão dos valores tipados da REST API ───────────────────────────────

// deno-lint-ignore no-explicit-any
type ValorFirestore = Record<string, any>

export function converterValor(v: ValorFirestore | undefined | null): unknown {
  if (!v || typeof v !== 'object') return null
  if ('nullValue' in v) return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('timestampValue' in v) return v.timestampValue
  if ('referenceValue' in v) return v.referenceValue
  if ('bytesValue' in v) return v.bytesValue
  if ('geoPointValue' in v) return { latitude: v.geoPointValue.latitude, longitude: v.geoPointValue.longitude }
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(converterValor)
  if ('mapValue' in v) return converterCampos(v.mapValue?.fields)
  return null
}

export function converterCampos(fields: Record<string, ValorFirestore> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = converterValor(v)
  return out
}

// ── Leitura ─────────────────────────────────────────────────────────────────

/** Um documento por caminho relativo ('residencia/roster'). null se não existe. */
export async function lerDocumento(caminho: string): Promise<Record<string, unknown> | null> {
  const token = await tokenGoogle()
  const url = `https://firestore.googleapis.com/v1/${raizDocumentos()}/${caminho
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (resp.status === 404) return null
  if (!resp.ok) throw new Error(`firestore_get_falhou: ${resp.status}`)
  const json = (await resp.json()) as { fields?: Record<string, ValorFirestore> }
  return converterCampos(json.fields)
}

/**
 * Vários documentos por caminho relativo ('colecao/id'), em lotes de 100 via
 * documents:batchGet. Devolve { caminho: dados } só com os que existem.
 */
export async function lerDocumentos(caminhos: string[]): Promise<Record<string, Record<string, unknown>>> {
  const resultado: Record<string, Record<string, unknown>> = {}
  if (caminhos.length === 0) return resultado
  const token = await tokenGoogle()
  const raiz = raizDocumentos()
  const url = `https://firestore.googleapis.com/v1/${raiz}:batchGet`

  for (let i = 0; i < caminhos.length; i += LOTE_BATCH_GET) {
    const lote = caminhos.slice(i, i + LOTE_BATCH_GET)
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: lote.map((c) => `${raiz}/${c}`) }),
    })
    if (!resp.ok) throw new Error(`firestore_batchget_falhou: ${resp.status}`)
    const itens = (await resp.json()) as Array<{ found?: { name: string; fields?: Record<string, ValorFirestore> } }>
    for (const item of itens) {
      if (!item.found) continue
      const relativo = item.found.name.slice(raiz.length + 1)
      resultado[decodeURIComponent(relativo)] = converterCampos(item.found.fields)
    }
  }
  return resultado
}

/** Coleção inteira (paginada). Só para coleções pequenas por construção. */
export async function listarColecao(colecao: string, maxDocs = 2000): Promise<Record<string, Record<string, unknown>>> {
  const token = await tokenGoogle()
  const resultado: Record<string, Record<string, unknown>> = {}
  let pageToken = ''
  do {
    const qs = new URLSearchParams({ pageSize: '300' })
    if (pageToken) qs.set('pageToken', pageToken)
    const resp = await fetch(
      `https://firestore.googleapis.com/v1/${raizDocumentos()}/${encodeURIComponent(colecao)}?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!resp.ok) throw new Error(`firestore_list_falhou: ${resp.status}`)
    const json = (await resp.json()) as {
      documents?: Array<{ name: string; fields?: Record<string, ValorFirestore> }>
      nextPageToken?: string
    }
    for (const d of json.documents ?? []) {
      resultado[decodeURIComponent(d.name.split('/').pop() as string)] = converterCampos(d.fields)
    }
    pageToken = json.nextPageToken ?? ''
  } while (pageToken && Object.keys(resultado).length < maxDocs)
  return resultado
}
