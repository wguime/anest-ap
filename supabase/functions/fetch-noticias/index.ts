/**
 * Edge Function: fetch-noticias
 *
 * Agrega notícias dos principais periódicos e sociedades de anestesiologia
 * via RSS, normaliza, deduplica e insere em `public.noticias`.
 *
 * Fontes:
 *   NEJM, Anesthesiology (ASA), BJA, A&A, ASA Monitor, SBA, BJAN.
 *
 * Deduplicação em 3 camadas:
 *   1. DOI exato            — quando o RSS expõe doi/dc:identifier.
 *   2. dedup_hash UNIQUE    — sha256(normalizeUrl + '|' + normalizeTitle).
 *   3. Trigram fuzzy >0.85  — fallback com janela ±7 dias.
 *
 * Quando a mesma notícia chega de outra fonte, em vez de criar linha
 * duplicada anexa { fonte, url } em `fontes_extras`.
 *
 * Authz: requer service_role (chamado por pg_cron diariamente).
 */

// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore - Deno import
import Parser from 'https://esm.sh/rss-parser@3.13.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Source {
  name: string
  url: string
  categoria: 'pesquisa' | 'sociedade' | 'clinica' | 'noticia'
  idioma: 'en' | 'pt-BR'
}

const SOURCES: Source[] = [
  { name: 'NEJM',           url: 'https://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm',                              categoria: 'pesquisa',  idioma: 'en' },
  { name: 'Anesthesiology', url: 'https://pubs.asahq.org/rss/site_5/176.xml',                                                    categoria: 'pesquisa',  idioma: 'en' },
  { name: 'BJA',            url: 'https://www.bjanaesthesia.org/action/showFeed?type=etoc&feed=rss&jc=bja',                      categoria: 'pesquisa',  idioma: 'en' },
  { name: 'A&A',            url: 'https://journals.lww.com/anesthesia-analgesia/_layouts/15/oaks.journals.mobile/feed.aspx?FeedType=CurrentIssue', categoria: 'pesquisa',  idioma: 'en' },
  { name: 'ASA Monitor',    url: 'https://pubs.asahq.org/rss/site_6/asa-monitor.xml',                                            categoria: 'sociedade', idioma: 'en' },
  { name: 'SBA',            url: 'https://www.sbahq.org/feed/',                                                                  categoria: 'sociedade', idioma: 'pt-BR' },
  { name: 'BJAN',           url: 'https://www.bjan-sba.org/rss/feed',                                                            categoria: 'pesquisa',  idioma: 'pt-BR' },
]

// Stopwords combinadas EN + PT-BR
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'for', 'and', 'or', 'on', 'to', 'with', 'by', 'is', 'are', 'as',
  'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
  'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'e', 'ou', 'com', 'sem',
])

// ----------------------------- Normalização ---------------------------------

function normalizeUrl(raw: string): string {
  if (!raw) return ''
  try {
    const u = new URL(raw)
    let host = u.host.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    let pathname = u.pathname.replace(/\/+$/, '')
    if (pathname === '') pathname = '/'
    return `https://${host}${pathname}`.toLowerCase()
  } catch {
    return raw.trim().toLowerCase()
  }
}

function normalizeTitle(raw: string): string {
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')          // strip diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')             // remove pontuação
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .sort()
    .join(' ')
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  // @ts-ignore Web Crypto in Deno
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDoi(item: any): string | null {
  // Tenta vários campos comuns de RSS
  const candidates = [
    item['prism:doi'],
    item['dc:identifier'],
    item.doi,
    item.guid,
    item.link,
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    const m = String(c).match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)
    if (m) return m[0].toLowerCase()
  }
  return null
}

function pickPublishedAt(item: any): string {
  const v = item.isoDate || item.pubDate || item['dc:date'] || new Date().toISOString()
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

// --------------------------- Dedup helpers ----------------------------------

async function appendFonteExtra(supabase: any, id: string, fonte: string, url: string) {
  // Lê fontes_extras atual e anexa nova entrada se ainda não estiver lá
  const { data, error } = await supabase
    .from('noticias')
    .select('fontes_extras, fonte')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return
  const arr: Array<{ fonte: string; url: string }> = Array.isArray(data.fontes_extras)
    ? data.fontes_extras
    : []
  if (data.fonte === fonte) return // mesma fonte primária, nada a fazer
  if (arr.some((x) => x.fonte === fonte)) return
  arr.push({ fonte, url })
  await supabase.from('noticias').update({ fontes_extras: arr }).eq('id', id)
}

interface DedupCheck {
  matchedId: string | null
}

async function findDuplicate(
  supabase: any,
  doi: string | null,
  dedupHash: string,
  tituloNorm: string,
  publicadoEm: string,
): Promise<DedupCheck> {
  // 1. DOI exato
  if (doi) {
    const { data } = await supabase
      .from('noticias')
      .select('id')
      .eq('doi', doi)
      .maybeSingle()
    if (data?.id) return { matchedId: data.id }
  }

  // 2. dedup_hash exato (rápido lookup antes de tentar INSERT ON CONFLICT)
  const { data: hashHit } = await supabase
    .from('noticias')
    .select('id')
    .eq('dedup_hash', dedupHash)
    .maybeSingle()
  if (hashHit?.id) return { matchedId: hashHit.id }

  // 3. Trigram fuzzy fallback (±7 dias)
  // Usa RPC inline via .rpc não está disponível sem função; fazemos via filter SQL builder
  // O ANEST não tem RPC custom — então usamos um SELECT direto com similarity().
  // Como similarity() não é exposto via PostgREST por padrão, recorremos a um filtro
  // que aproveita o índice GIN: titulo_norm % $1 (operator). PostgREST suporta % como filter.
  const fromDate = new Date(new Date(publicadoEm).getTime() - 7 * 24 * 3600 * 1000).toISOString()
  const toDate = new Date(new Date(publicadoEm).getTime() + 7 * 24 * 3600 * 1000).toISOString()

  // Set similarity threshold via session GUC não funciona aqui; usamos filter numa similarity
  // computed via cosine match de tokens — implementação simples client-side: query títulos
  // recentes e compara em JS.
  const { data: candidates } = await supabase
    .from('noticias')
    .select('id, titulo_norm')
    .gte('publicado_em', fromDate)
    .lte('publicado_em', toDate)
    .limit(200)

  if (Array.isArray(candidates)) {
    for (const c of candidates) {
      if (jaccardSimilarity(tituloNorm, c.titulo_norm) > 0.85) {
        return { matchedId: c.id }
      }
    }
  }

  return { matchedId: null }
}

function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const sa = new Set(a.split(' ').filter(Boolean))
  const sb = new Set(b.split(' ').filter(Boolean))
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

// --------------------------- Process source ---------------------------------

interface SourceResult {
  name: string
  fetched: number
  inserted: number
  deduped: number
  errors: number
  errorMessages: string[]
}

async function processSource(supabase: any, parser: any, source: Source): Promise<SourceResult> {
  const result: SourceResult = {
    name: source.name,
    fetched: 0,
    inserted: 0,
    deduped: 0,
    errors: 0,
    errorMessages: [],
  }

  let feed: any
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30_000)
    try {
      const res = await fetch(source.url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'ANEST-NewsBot/1.0 (+https://anest-ap.web.app)' },
      })
      const xml = await res.text()
      feed = await parser.parseString(xml)
    } finally {
      clearTimeout(timer)
    }
  } catch (err: any) {
    result.errors++
    result.errorMessages.push(`fetch/parse: ${err?.message || err}`)
    return result
  }

  const items = Array.isArray(feed?.items) ? feed.items : []
  result.fetched = items.length

  for (const item of items) {
    try {
      const titulo = String(item.title || '').trim()
      const link = String(item.link || item.guid || '').trim()
      if (!titulo || !link) continue

      const rawUrl = link
      const fonteUrl = normalizeUrl(link)
      const tituloNorm = normalizeTitle(titulo)
      const dedupHash = await sha256Hex(`${fonteUrl}|${tituloNorm}`)
      const doi = extractDoi(item)
      const publicadoEm = pickPublishedAt(item)
      const resumoRaw = item.contentSnippet || item.content || item.summary || item.description || ''
      const resumo = stripHtml(String(resumoRaw)).slice(0, 2000) || null
      const autores = item.creator || item['dc:creator'] || item.author || null
      const externalId = String(item.guid || item.id || link)

      const { matchedId } = await findDuplicate(supabase, doi, dedupHash, tituloNorm, publicadoEm)

      if (matchedId) {
        await appendFonteExtra(supabase, matchedId, source.name, rawUrl)
        result.deduped++
        continue
      }

      const row = {
        titulo,
        resumo,
        autores: typeof autores === 'string' ? autores : null,
        idioma: source.idioma,
        fonte: source.name,
        fonte_url: fonteUrl,
        raw_url: rawUrl,
        categoria: source.categoria,
        doi,
        external_id: externalId,
        dedup_hash: dedupHash,
        titulo_norm: tituloNorm,
        publicado_em: publicadoEm,
      }

      const { error: insertErr } = await supabase
        .from('noticias')
        .insert(row)

      if (insertErr) {
        // Race condition: alguém pode ter inserido entre o findDuplicate e o INSERT.
        // Se for violação UNIQUE, tratamos como dedup.
        if (insertErr.code === '23505' || /duplicate key/.test(insertErr.message)) {
          result.deduped++
        } else {
          result.errors++
          result.errorMessages.push(`insert: ${insertErr.message}`)
        }
      } else {
        result.inserted++
      }
    } catch (err: any) {
      result.errors++
      result.errorMessages.push(`item: ${err?.message || err}`)
    }
  }

  return result
}

// ------------------------------ Handler -------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // @ts-ignore Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // @ts-ignore Deno global
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const parser = new Parser({ timeout: 30_000 })

    const ranAt = new Date().toISOString()
    const results: SourceResult[] = []

    for (const source of SOURCES) {
      try {
        const r = await processSource(supabase, parser, source)
        results.push(r)
      } catch (err: any) {
        results.push({
          name: source.name,
          fetched: 0,
          inserted: 0,
          deduped: 0,
          errors: 1,
          errorMessages: [String(err?.message || err)],
        })
      }
    }

    const totals = results.reduce(
      (acc, r) => ({
        fetched: acc.fetched + r.fetched,
        inserted: acc.inserted + r.inserted,
        deduped: acc.deduped + r.deduped,
        errors: acc.errors + r.errors,
      }),
      { fetched: 0, inserted: 0, deduped: 0, errors: 0 }
    )

    return new Response(
      JSON.stringify({ ok: true, ranAt, totals, sources: results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
