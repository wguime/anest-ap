/**
 * Edge Function: fetch-classics
 *
 * Backfill de artigos clássicos de alta relevância para categorias com
 * volume baixo (< MIN_PER_CATEGORY). Usa PubMed E-utilities API
 * (esearch + esummary, sort=relevance) sem necessidade de API key.
 *
 * Para cada uma das 12 categorias temáticas, conta artigos atuais e, se
 * abaixo do mínimo, busca artigos de alta relevância (top citados/recentes
 * dentro de uma janela de 10 anos) e insere reaproveitando o pipeline de
 * dedup da tabela `noticias` (DOI + dedup_hash).
 *
 * Schedule recomendado: mensal (1º domingo do mês).
 */

// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_PER_CATEGORY = 15
const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const FONTE_LABEL = 'PubMed Classics'

// Categorias temáticas → query PubMed (operadores MeSH/text). Ordem alinhada
// com `categorize_noticia()` SQL.
const CATEGORY_QUERIES: Record<string, string> = {
  'Via Aérea':              '(("Airway Management"[Mesh]) OR (difficult intubation[Title/Abstract]) OR (supraglottic airway[Title/Abstract])) AND (anesthesia[Title/Abstract])',
  'Anestesia Regional':     '("Anesthesia, Conduction"[Mesh]) OR (peripheral nerve block[Title/Abstract]) OR (ultrasound-guided regional anesthesia[Title/Abstract])',
  'Perioperatório':         '("Perioperative Care"[Mesh]) OR (enhanced recovery after surgery[Title/Abstract]) OR (postoperative outcomes[Title/Abstract])',
  'Dor':                    '("Pain Management"[Mesh] AND anesthesia[Title/Abstract]) OR (acute postoperative pain[Title/Abstract]) OR (multimodal analgesia[Title/Abstract])',
  'Farmacologia':           '("Anesthetics"[Mesh] AND pharmacology[Title/Abstract]) OR (propofol pharmacokinetics[Title/Abstract]) OR (remifentanil[Title/Abstract])',
  'Segurança do Paciente':  '("Patient Safety"[Mesh] AND anesthesia[Title/Abstract]) OR (anesthesia-related mortality[Title/Abstract]) OR (perioperative adverse events[Title/Abstract])',
  'Cardiovascular':         '("Anesthesia, Cardiac Procedures"[Mesh]) OR (cardiac anesthesia[Title/Abstract]) OR (perioperative hemodynamics[Title/Abstract])',
  'Obstetrícia':            '("Anesthesia, Obstetrical"[Mesh]) OR (cesarean delivery anesthesia[Title/Abstract]) OR (labor analgesia[Title/Abstract])',
  'Pediatria':              '("Anesthesia"[Mesh] AND ("Child"[Mesh] OR "Infant"[Mesh])) OR (pediatric anesthesia[Title/Abstract]) OR (neonatal anesthesia[Title/Abstract])',
  'Terapia Intensiva':      '("Critical Care"[Mesh]) OR (mechanical ventilation ICU[Title/Abstract]) OR (sepsis intensive care[Title/Abstract])',
  'Neuroanestesia':         '("Anesthesia"[Mesh] AND "Neurosurgical Procedures"[Mesh]) OR (neuroanesthesia[Title/Abstract]) OR (craniotomy anesthesia[Title/Abstract])',
  'Tecnologia e IA':        '(artificial intelligence anesthesia[Title/Abstract]) OR (machine learning perioperative[Title/Abstract]) OR (deep learning anesthesia[Title/Abstract])',
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'for', 'and', 'or', 'on', 'to', 'with', 'by', 'is', 'are', 'as',
  'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
  'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'e', 'ou', 'com', 'sem',
])

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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
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

async function pubmedSearch(query: string, retmax: number): Promise<string[]> {
  // Janela 10 anos para "alta relevância recente" + sort relevance
  const yearStart = new Date().getUTCFullYear() - 10
  const fullTerm = `(${query}) AND (${yearStart}:3000[PDAT])`
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(fullTerm)}&retmax=${retmax}&retmode=json&sort=relevance`
  const res = await fetch(url, { headers: { 'User-Agent': 'ANEST-NewsBot/1.0' } })
  if (!res.ok) throw new Error(`esearch ${res.status}`)
  const json = await res.json()
  const ids = json?.esearchresult?.idlist
  return Array.isArray(ids) ? ids : []
}

interface PubmedItem {
  pmid: string
  title: string
  authors: string
  pubdate: string
  journal: string
  doi: string | null
  url: string
}

async function pubmedSummary(pmids: string[]): Promise<PubmedItem[]> {
  if (pmids.length === 0) return []
  const url = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'ANEST-NewsBot/1.0' } })
  if (!res.ok) throw new Error(`esummary ${res.status}`)
  const json = await res.json()
  const result = json?.result
  if (!result) return []

  const items: PubmedItem[] = []
  for (const pmid of pmids) {
    const r = result[pmid]
    if (!r) continue
    const title = String(r.title || '').trim()
    if (!title) continue

    let doi: string | null = null
    if (Array.isArray(r.articleids)) {
      for (const ai of r.articleids) {
        if (ai?.idtype === 'doi' && typeof ai.value === 'string') {
          doi = ai.value.toLowerCase()
          break
        }
      }
    }

    const authors = Array.isArray(r.authors)
      ? r.authors.map((a: { name?: string }) => a?.name).filter(Boolean).slice(0, 6).join(', ')
      : ''

    const pubdate = (() => {
      const v = r.sortpubdate || r.epubdate || r.pubdate || ''
      const d = new Date(v)
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    })()

    items.push({
      pmid,
      title,
      authors,
      pubdate,
      journal: String(r.fulljournalname || r.source || '').trim(),
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    })
  }
  return items
}

async function jaccardCheck(supabase: any, tituloNorm: string, publicadoEm: string): Promise<boolean> {
  // Trigram fuzzy fallback ±7 dias (mesmo critério do fetch-noticias)
  const fromDate = new Date(new Date(publicadoEm).getTime() - 7 * 24 * 3600 * 1000).toISOString()
  const toDate = new Date(new Date(publicadoEm).getTime() + 7 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('noticias')
    .select('titulo_norm')
    .gte('publicado_em', fromDate)
    .lte('publicado_em', toDate)
    .limit(200)
  if (!Array.isArray(data)) return false
  const sa = new Set(tituloNorm.split(' ').filter(Boolean))
  for (const c of data) {
    const sb = new Set(String(c.titulo_norm || '').split(' ').filter(Boolean))
    if (sa.size === 0 || sb.size === 0) continue
    let inter = 0
    for (const t of sa) if (sb.has(t)) inter++
    const union = sa.size + sb.size - inter
    if (union > 0 && inter / union > 0.85) return true
  }
  return false
}

interface CategoryResult {
  category: string
  before: number
  fetched: number
  inserted: number
  deduped: number
  errors: string[]
}

async function processCategory(supabase: any, category: string, query: string): Promise<CategoryResult> {
  const result: CategoryResult = {
    category,
    before: 0,
    fetched: 0,
    inserted: 0,
    deduped: 0,
    errors: [],
  }

  const { count, error: countErr } = await supabase
    .from('noticias')
    .select('id', { count: 'exact', head: true })
    .eq('category', category)
  if (countErr) {
    result.errors.push(`count: ${countErr.message}`)
    return result
  }
  result.before = count ?? 0

  if (result.before >= MIN_PER_CATEGORY) return result

  const needed = MIN_PER_CATEGORY - result.before
  const overfetch = Math.min(50, needed * 3)

  let pmids: string[]
  try {
    pmids = await pubmedSearch(query, overfetch)
  } catch (err: any) {
    result.errors.push(`esearch: ${err?.message || err}`)
    return result
  }
  if (pmids.length === 0) return result

  let items: PubmedItem[]
  try {
    items = await pubmedSummary(pmids)
  } catch (err: any) {
    result.errors.push(`esummary: ${err?.message || err}`)
    return result
  }

  result.fetched = items.length

  for (const item of items) {
    if (result.inserted >= needed) break
    try {
      const fonteUrl = normalizeUrl(item.url)
      const tituloNorm = normalizeTitle(item.title)
      const dedupHash = await sha256Hex(`${fonteUrl}|${tituloNorm}`)

      // 1. dedup por DOI
      if (item.doi) {
        const { data: doiHit } = await supabase
          .from('noticias').select('id').eq('doi', item.doi).maybeSingle()
        if (doiHit?.id) { result.deduped++; continue }
      }
      // 2. dedup por hash
      const { data: hashHit } = await supabase
        .from('noticias').select('id').eq('dedup_hash', dedupHash).maybeSingle()
      if (hashHit?.id) { result.deduped++; continue }
      // 3. dedup trigram fuzzy
      if (await jaccardCheck(supabase, tituloNorm, item.pubdate)) {
        result.deduped++
        continue
      }

      const row = {
        titulo: item.title,
        resumo: null,
        autores: item.authors || null,
        idioma: 'en',
        fonte: FONTE_LABEL,
        fonte_url: fonteUrl,
        raw_url: item.url,
        categoria: 'pesquisa',
        category, // override do trigger — força a categoria correta
        doi: item.doi,
        external_id: `pmid:${item.pmid}`,
        dedup_hash: dedupHash,
        titulo_norm: tituloNorm,
        publicado_em: item.pubdate,
        pmid: item.pmid,
        journal_issn: item.journal || null,
      }

      const { error: insertErr } = await supabase.from('noticias').insert(row)
      if (insertErr) {
        if (insertErr.code === '23505' || /duplicate key/.test(insertErr.message)) {
          result.deduped++
        } else {
          result.errors.push(`insert ${item.pmid}: ${insertErr.message}`)
        }
      } else {
        result.inserted++
      }
    } catch (err: any) {
      result.errors.push(`item ${item.pmid}: ${err?.message || err}`)
    }
  }

  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ranAt = new Date().toISOString()
    const results: CategoryResult[] = []

    for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
      const r = await processCategory(supabase, category, query)
      results.push(r)
      // Rate-limit suave: PubMed permite 3 req/s sem API key
      await new Promise((r) => setTimeout(r, 400))
    }

    const totals = results.reduce(
      (acc, r) => ({
        fetched: acc.fetched + r.fetched,
        inserted: acc.inserted + r.inserted,
        deduped: acc.deduped + r.deduped,
        errors: acc.errors + r.errors.length,
      }),
      { fetched: 0, inserted: 0, deduped: 0, errors: 0 },
    )

    return new Response(JSON.stringify({ ok: true, ranAt, totals, categories: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
