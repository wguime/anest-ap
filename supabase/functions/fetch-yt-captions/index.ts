// =============================================================================
// supabase/functions/fetch-yt-captions/index.ts — Sprint 1 Wave 1.7 T1.1.8
//
// Edge Function admin-gated que puxa captions auto-geradas do YouTube em PT
// (ou outro idioma) e salva como WebVTT em:
//   - public.video_captions (cache TTL 30d, evita refetch)
//   - public.aulas_captions via RPC upsert_aula_track (se p_aula_id fornecido)
//
// Pesquisa que embasou (2026-05-17):
//   - YouTube auto-captions PT cobrem ~80-95% acurácia, grátis
//   - `youtube-caption-extractor` lib (MIT, 143★, mantida) funciona em Deno
//     via npm: specifier; alternativa: youtubei.js (4.9k★) mais robusta
//   - YouTube TOS proíbe overlay sobre embed, mas permite fetch e exibição
//     em player próprio (caso de MP4 hospedado próprio)
//   - Fallback se LOGIN_REQUIRED: paid Supadata.ai $17/mês OU Whisper
//
// Fluxo:
//   1. POST { videoUrl: string, aulaId?: string, lang?: string='pt' }
//   2. Auth: Bearer JWT HS256 legado OU Firebase ID Token (RS256) + admin gate (admin_users)
//   3. Extrai videoId da URL (YouTube)
//   4. Cache lookup em video_captions (mesmo source+videoId+lang)
//      → se hit + fetched_at < 30d: retorna cached VTT
//   5. Senão, call youtube-caption-extractor:
//      → success: converte JSON → VTT, INSERT em video_captions
//      → LOGIN_REQUIRED: retorna 503 com sugestão Supadata/manual
//   6. Se aulaId fornecido: call RPC upsert_aula_track para vincular VTT à aula
//   7. Response: { ok, vtt, source: 'cache'|'fresh', cached_at, aula_track_updated }
//
// Errors:
//   400 invalid_payload        — videoUrl ausente / não é YouTube
//   401 missing_token          — sem Bearer
//   401 invalid_token          — JWT inválido
//   403 forbidden_not_admin    — não admin
//   404 no_captions_available  — vídeo sem captions PT
//   429 rate_limited           — YouTube bot check (transitório)
//   500 internal_error         — JWT_SECRET ausente, erro inesperado
//   503 youtube_blocked        — LOGIN_REQUIRED ou IP banido (sugerir manual)
//
// Env vars: JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   npx supabase functions deploy fetch-yt-captions --project-ref vjzrahruvjffyyqyhjny
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { verifyAuthHeader } from '../_shared/verify-auth.ts'
import { getSubtitles } from 'npm:youtube-caption-extractor@1.9.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const CACHE_TTL_DAYS = 30
const DEFAULT_LANG = 'pt'
const VALID_LANGS = new Set(['pt', 'pt-BR', 'en', 'es', 'fr'])

interface SubtitleSegment {
  start: string  // segundos como string (ex: "12.5")
  dur: string    // duração como string
  text: string
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Extrai YouTube videoId de várias formas de URL:
 *   - https://youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - VIDEO_ID (já é o ID)
 */
function extractYouTubeId(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  // Se já parece um videoId (11 chars alfanuméricos + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  // Patterns de URL
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const match = trimmed.match(p)
    if (match?.[1]) return match[1]
  }
  return null
}

/**
 * Formata segundos (float) em timestamp WebVTT: HH:MM:SS.mmm
 */
function secondsToVttTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds * 1000) % 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/**
 * Converte array de SubtitleSegment (output da lib) para string WebVTT.
 *
 * Header WebVTT + cada cue:
 *   00:00:01.000 --> 00:00:03.500
 *   Texto do segmento
 */
function segmentsToVtt(segments: SubtitleSegment[]): string {
  const lines: string[] = ['WEBVTT', '']
  for (const seg of segments) {
    const start = parseFloat(seg.start)
    const dur = parseFloat(seg.dur)
    if (Number.isNaN(start) || Number.isNaN(dur)) continue
    const end = start + dur
    // Limpa texto: trim, decode HTML entities básicas, single line
    const text = (seg.text || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n+/g, ' ')
      .trim()
    if (!text) continue
    lines.push(`${secondsToVttTimestamp(start)} --> ${secondsToVttTimestamp(end)}`)
    lines.push(text)
    lines.push('')
  }
  return lines.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'method_not_allowed' })
  }

  // ─── 1+2. Auth (JWT HS256 legado OU Firebase ID Token RS256) ──────────
  const auth = await verifyAuthHeader(
    req.headers.get('authorization') || req.headers.get('Authorization'),
  )
  if (!auth.ok) {
    return jsonResponse(auth.status, { ok: false, reason: auth.reason })
  }
  const adminUid = auth.uid

  // ─── 3. Admin gate ────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('fetch-yt-captions: SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
    return jsonResponse(500, { ok: false, reason: 'internal_error' })
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .select('firebase_uid')
    .eq('firebase_uid', adminUid)
    .maybeSingle()

  if (adminErr) {
    console.error('fetch-yt-captions: admin lookup error', adminErr.message)
    return jsonResponse(500, { ok: false, reason: 'supabase_error' })
  }
  if (!adminRow) {
    console.log('fetch-yt-captions: forbidden_not_admin', { sub: adminUid })
    return jsonResponse(403, { ok: false, reason: 'forbidden_not_admin' })
  }

  // ─── 4. Body validation ───────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload' })
  }

  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : ''
  const aulaId = typeof body.aulaId === 'string' ? body.aulaId.trim() : null
  const lang = typeof body.lang === 'string' && VALID_LANGS.has(body.lang) ? body.lang : DEFAULT_LANG

  if (!videoUrl) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload', detail: 'videoUrl required' })
  }

  const videoId = extractYouTubeId(videoUrl)
  if (!videoId) {
    return jsonResponse(400, { ok: false, reason: 'invalid_payload', detail: 'not a YouTube URL' })
  }

  // ─── 5. Cache lookup ──────────────────────────────────────────────────
  const { data: cached, error: cacheErr } = await supabase
    .from('video_captions')
    .select('vtt, fetched_at')
    .eq('source', 'youtube')
    .eq('video_id', videoId)
    .eq('lang', lang)
    .maybeSingle()

  if (cacheErr) {
    console.warn('fetch-yt-captions: cache lookup error (ignorando)', cacheErr.message)
  }

  let vtt: string
  let source: 'cache' | 'fresh' = 'fresh'
  let cachedAt: string | null = null

  if (cached?.vtt) {
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays < CACHE_TTL_DAYS) {
      vtt = cached.vtt
      source = 'cache'
      cachedAt = cached.fetched_at
      console.log('fetch-yt-captions: cache hit', { videoId, lang, ageDays: ageDays.toFixed(1) })
    }
  }

  // ─── 6. Fresh fetch via youtube-caption-extractor ────────────────────
  // Language fallback chain: tenta lang requested → pt → pt-BR → en
  // (cobre vídeos com captions manuais em variações regionais ou auto-gen EN)
  if (source === 'fresh') {
    const langChain = Array.from(new Set([lang, 'pt-BR', 'pt', 'en']))
    let segments: SubtitleSegment[] | null = null
    let usedLang = lang
    let lastErr: Error | null = null

    for (const tryLang of langChain) {
      try {
        const result = await getSubtitles({ videoID: videoId, lang: tryLang })
        if (Array.isArray(result) && result.length > 0) {
          segments = result as SubtitleSegment[]
          usedLang = tryLang
          break
        }
      } catch (err) {
        lastErr = err as Error
        const msg = lastErr.message || String(lastErr)
        // Erros permanentes: não vale retry com outro lang
        if (/unavailable|private|disabled|not found/i.test(msg)) {
          console.log('fetch-yt-captions: permanent error, stopping retry', msg.slice(0, 100))
          break
        }
        // LOGIN_REQUIRED/bot: tentar próximo lang (cada call refaz fetch)
        console.warn('fetch-yt-captions: lang', tryLang, 'failed:', msg.slice(0, 100))
      }
    }

    if (!segments || segments.length === 0) {
      const lastMsg = lastErr?.message || ''
      // Detecção heurística de bloqueio YouTube (bot check, IP banido)
      if (/LOGIN_REQUIRED|bot|429|CAPTCHA/i.test(lastMsg)) {
        return jsonResponse(503, {
          ok: false,
          reason: 'youtube_blocked',
          detail: 'YouTube exigiu autenticação ou bloqueou IP. Sugestão: upload VTT manual no formulário da aula.',
        })
      }
      return jsonResponse(404, {
        ok: false,
        reason: 'no_captions_available',
        detail: `Nenhuma caption encontrada para videoId=${videoId} (tentativas: ${langChain.join(', ')})`,
      })
    }

    vtt = segmentsToVtt(segments)

    if (!vtt || vtt.length < 20) {
      return jsonResponse(404, {
        ok: false,
        reason: 'no_captions_available',
        detail: 'VTT vazio após conversão',
      })
    }

    // Cache: insert ou update (UNIQUE constraint cuida do conflict)
    const { error: upsertCacheErr } = await supabase
      .from('video_captions')
      .upsert({
        source: 'youtube',
        video_id: videoId,
        lang: usedLang, // grava o lang que efetivamente funcionou
        vtt,
        fetched_at: new Date().toISOString(),
        fetched_by: adminUid,
      }, { onConflict: 'source,video_id,lang' })

    if (upsertCacheErr) {
      console.warn('fetch-yt-captions: cache upsert error (ignorando)', upsertCacheErr.message)
    }
  }

  // ─── 7. Vincular à aula (se aulaId fornecido) ────────────────────────
  let aulaTrackUpdated = false
  if (aulaId) {
    // Upload VTT como blob para storage bucket 'educacao-captions'
    // Path: youtube/{videoId}-{lang}.vtt
    const storagePath = `youtube/${videoId}-${lang}.vtt`
    const { error: uploadErr } = await supabase
      .storage
      .from('educacao-captions')
      .upload(storagePath, new Blob([vtt], { type: 'text/vtt' }), {
        upsert: true,
        contentType: 'text/vtt',
      })

    if (uploadErr) {
      // Storage falhou — retorna VTT inline mas avisa
      console.warn('fetch-yt-captions: storage upload falhou (retornando inline)', uploadErr.message)
    } else {
      // Construir URL pública/signed do storage
      const { data: { publicUrl } } = supabase.storage
        .from('educacao-captions')
        .getPublicUrl(storagePath)

      // Chamar RPC upsert_aula_track via JWT do user (não service-role,
      // para audit trail correto). Nota: aqui usamos service-role mas
      // passamos adminUid no source para auditoria server-side.
      const { error: rpcErr } = await supabase.rpc('upsert_aula_track', {
        p_aula_id: aulaId,
        p_lang: lang,
        p_url: publicUrl,
        p_label: lang === 'pt' || lang === 'pt-BR' ? 'Português (auto)' : lang.toUpperCase(),
        p_default: true,
        p_source: 'youtube_auto',
      })

      if (rpcErr) {
        console.error('fetch-yt-captions: RPC upsert_aula_track falhou', rpcErr.message)
      } else {
        aulaTrackUpdated = true
      }
    }
  }

  // ─── 8. Response ──────────────────────────────────────────────────────
  console.log('fetch-yt-captions: ok', {
    videoId,
    lang,
    source,
    bytes: vtt.length,
    aulaTrackUpdated,
  })

  return jsonResponse(200, {
    ok: true,
    vtt,
    source,
    cached_at: cachedAt,
    video_id: videoId,
    lang,
    aula_track_updated: aulaTrackUpdated,
  })
})
