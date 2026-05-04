/**
 * Edge Function: ingest-uptodate
 *
 * Recebe payload do scraper externo (GitHub Actions + Playwright) e faz
 * upsert em `public.uptodate_topics`. Autenticação via HMAC-SHA256 sobre
 * o body, usando o secret compartilhado `INGEST_UPTODATE_SECRET`.
 *
 * Por que HMAC e não service_role bearer? O service_role nunca deve sair
 * do servidor. Um shared secret HMAC é suficiente para autenticar a origem
 * do payload — a Edge Function lê SUPABASE_SERVICE_ROLE_KEY internamente.
 *
 * Fluxo:
 *   1. Verifica method=POST e header `x-anest-signature`.
 *   2. Recalcula HMAC-SHA256(body, SECRET) e compara em tempo constante.
 *   3. Para cada item: upsert por `dedup_hash` (UNIQUE).
 *   4. Recomputa `is_featured` via RPC `uptodate_refresh_featured`.
 *
 * Deploy: supabase functions deploy ingest-uptodate --no-verify-jwt
 */

// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SHARED_SECRET = Deno.env.get('INGEST_UPTODATE_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Limites de payload — defesa contra bloat se o scraper for comprometido
const MAX_ITEMS = 500
const MAX_TITULO = 500
const MAX_TITULO_NORM = 500
const MAX_RESUMO_HTML = 50_000 // 50 KB
const MAX_RESUMO_TEXTO = 20_000
const MAX_FONTE_URL = 2048
const MAX_DEDUP_HASH = 256
const MAX_TOPIC_ID = 100
const MAX_CATEGORIA = 100
const MAX_SECAO = 200
const MAX_PUBLICADO_EM = 64

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anest-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Sanitização defense-in-depth: o scraper já entrega HTML "limpo", mas se for
// comprometido não queremos que script/iframe/event-handler entrem no DB e
// renderizem no front. Strip de tags ativas e atributos perigosos.
const DANGEROUS_TAGS_PAIRED = /<(script|style|iframe|object|embed|form|svg|math|frame|frameset)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
const DANGEROUS_TAGS_SELFCLOSING = /<\/?(script|style|iframe|object|embed|form|svg|math|frame|frameset|link|meta|base)\b[^>]*\/?>/gi
const EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JS_URLS = /\s+(href|src|action|formaction)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi
const NON_IMAGE_DATA_URLS = /\s+(href|src)\s*=\s*(?:"data:(?!image\/)[^"]*"|'data:(?!image\/)[^']*')/gi

function sanitizeHtml(html: string): string {
  if (!html) return html
  return html
    .replace(DANGEROUS_TAGS_PAIRED, '')
    .replace(DANGEROUS_TAGS_SELFCLOSING, '')
    .replace(EVENT_HANDLERS, '')
    .replace(JS_URLS, '')
    .replace(NON_IMAGE_DATA_URLS, '')
}

interface Item {
  titulo: string
  resumo_html?: string | null
  resumo_texto?: string | null
  topic_id?: string | null
  fonte_url: string
  categoria?: string | null
  secao?: string | null
  titulo_norm: string
  dedup_hash: string
  publicado_em: string
}

async function verifyHmac(rawBody: string, signature: string): Promise<boolean> {
  if (!SHARED_SECRET || !signature) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SHARED_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  // Comparação tempo constante
  if (hex.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) {
    diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!SHARED_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const signature = req.headers.get('x-anest-signature') || ''
  const raw = await req.text()
  const ok = await verifyHmac(raw, signature)
  if (!ok) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: { items?: Item[] }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const items = Array.isArray(payload.items) ? payload.items : []
  if (items.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, updated: 0, skipped: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (items.length > MAX_ITEMS) {
    return new Response(
      JSON.stringify({ error: 'too_many_items', max: MAX_ITEMS, received: items.length }),
      { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let inserted = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const it of items) {
    if (!it.titulo || !it.fonte_url || !it.dedup_hash || !it.titulo_norm || !it.publicado_em) {
      skipped++
      continue
    }
    // Cap por campo: rejeita item com strings absurdamente longas em vez de truncar
    // silenciosamente (truncar pode quebrar dedup_hash/URL e causar duplicatas).
    if (
      typeof it.titulo !== 'string' || it.titulo.length > MAX_TITULO ||
      typeof it.titulo_norm !== 'string' || it.titulo_norm.length > MAX_TITULO_NORM ||
      typeof it.fonte_url !== 'string' || it.fonte_url.length > MAX_FONTE_URL ||
      typeof it.dedup_hash !== 'string' || it.dedup_hash.length > MAX_DEDUP_HASH ||
      typeof it.publicado_em !== 'string' || it.publicado_em.length > MAX_PUBLICADO_EM ||
      (it.resumo_html != null && (typeof it.resumo_html !== 'string' || it.resumo_html.length > MAX_RESUMO_HTML)) ||
      (it.resumo_texto != null && (typeof it.resumo_texto !== 'string' || it.resumo_texto.length > MAX_RESUMO_TEXTO)) ||
      (it.topic_id != null && (typeof it.topic_id !== 'string' || it.topic_id.length > MAX_TOPIC_ID)) ||
      (it.categoria != null && (typeof it.categoria !== 'string' || it.categoria.length > MAX_CATEGORIA)) ||
      (it.secao != null && (typeof it.secao !== 'string' || it.secao.length > MAX_SECAO))
    ) {
      skipped++
      continue
    }
    const row = {
      titulo: it.titulo,
      resumo_html: it.resumo_html ? sanitizeHtml(it.resumo_html) : null,
      resumo_texto: it.resumo_texto ?? null,
      topic_id: it.topic_id ?? null,
      fonte: 'UpToDate',
      fonte_url: it.fonte_url,
      categoria: it.categoria ?? 'anesthesiology',
      secao: it.secao ?? null,
      titulo_norm: it.titulo_norm,
      dedup_hash: it.dedup_hash,
      publicado_em: it.publicado_em,
      fetched_at: new Date().toISOString(),
    }
    const { data, error } = await sb
      .from('uptodate_topics')
      .upsert(row, { onConflict: 'dedup_hash', ignoreDuplicates: false })
      .select('id, created_at, updated_at')
      .single()
    if (error) {
      skipped++
      errors.push(error.message)
      continue
    }
    // Heurística inserção vs atualização: created_at == updated_at (até ms)
    if (data && data.created_at === data.updated_at) inserted++
    else updated++
  }

  // Refresh featured (top 10 mais recentes)
  const { error: rpcError } = await sb.rpc('uptodate_refresh_featured')
  if (rpcError) errors.push(`refresh_featured: ${rpcError.message}`)

  return new Response(
    JSON.stringify({ inserted, updated, skipped, errors: errors.slice(0, 5) }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
