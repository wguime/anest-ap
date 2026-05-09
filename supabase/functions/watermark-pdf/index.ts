/**
 * Edge Function: watermark-pdf
 *
 * Aplica watermark dinâmico em um PDF do Storage e retorna o binário marcado.
 *
 * Uso esperado (Onda 1-2 do roadmap ANEST):
 *   POST { docId, storagePath, viewerId, viewerEmail }
 *   Authorization: Bearer <Supabase JWT do usuário>
 *
 * Esta edge é o caminho para casos onde precisamos do IP real do leitor
 * (extraído de `X-Forwarded-For`). O caminho default — e mais barato — é
 * client-side via `<PDFViewerWithWatermark />`. Use esta função quando a
 * política de retenção/forense exigir o IP real registrado na marca.
 *
 * Env vars necessárias:
 *   SUPABASE_URL                 — URL do projeto
 *   SUPABASE_SERVICE_ROLE_KEY    — service-role para baixar do Storage
 *   JWT_SECRET                   — segredo HS256 do Supabase (validar Bearer)
 *   ALLOWED_ORIGIN               — origem permitida no CORS (default: anest-ap.web.app)
 */

import { jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'
import { PDFDocument, rgb, degrees, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://anest-ap.web.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WatermarkPayload {
  docId?: string
  storagePath: string
  viewerId?: string
  viewerEmail?: string
}

// ---------------------------------------------------------------------------
// Watermark helpers — inline (espelha src/utils/watermark.js, sem _shared/)
// ---------------------------------------------------------------------------
async function stampPdf(
  pdfBytes: Uint8Array,
  opts: { text: string; subLines?: string[]; opacity?: number; rotation?: number; fontSize?: number },
): Promise<Uint8Array> {
  const { text, subLines = [], opacity = 0.18, rotation = -30, fontSize = 48 } = opts
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const subFontSize = Math.max(8, Math.round(fontSize * 0.28))
  const lineGap = Math.round(subFontSize * 1.4)
  const color = rgb(0.5, 0.5, 0.5)
  const rotateBy = degrees(rotation)

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const mainW = font.widthOfTextAtSize(text, fontSize)
    const mainX = width / 2 - mainW / 2
    const mainY = height / 2
    page.drawText(text, { x: mainX, y: mainY, size: fontSize, font, color, opacity, rotate: rotateBy })
    subLines.forEach((line, idx) => {
      if (!line) return
      const w = font.widthOfTextAtSize(line, subFontSize)
      page.drawText(String(line), {
        x: width / 2 - w / 2,
        y: mainY - lineGap * (idx + 1) - fontSize * 0.4,
        size: subFontSize,
        font,
        color,
        opacity,
        rotate: rotateBy,
      })
    })
  }
  return doc.save()
}

function buildLines(info: { name?: string; email?: string; ip?: string; timestamp?: string }): string[] {
  const out: string[] = []
  if (info.name) out.push(info.name)
  if (info.email) out.push(info.email)
  if (info.ip) out.push(`IP: ${info.ip}`)
  if (info.timestamp) out.push(info.timestamp)
  return out
}

// ---------------------------------------------------------------------------
// JWT validation — HS256 com JWT_SECRET (mesmo emitido pela get-supabase-token)
// ---------------------------------------------------------------------------
async function verifyBearer(authHeader: string | null): Promise<{ sub: string; email?: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.slice(7)
  const jwtSecret = Deno.env.get('JWT_SECRET')
  if (!jwtSecret) throw new Error('JWT_SECRET not configured')
  const secretKey = new TextEncoder().encode(jwtSecret)
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] })
  return { sub: String(payload.sub || ''), email: payload.email as string | undefined }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
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
    const auth = await verifyBearer(req.headers.get('authorization'))

    const payload = (await req.json()) as WatermarkPayload
    if (!payload?.storagePath) {
      return new Response(JSON.stringify({ error: 'storagePath is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase service credentials not configured')
    }

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // storagePath é "bucket/path/to/file.pdf" — primeiro segmento é o bucket.
    const firstSlash = payload.storagePath.indexOf('/')
    if (firstSlash <= 0) {
      return new Response(JSON.stringify({ error: 'storagePath must be "bucket/path"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const bucket = payload.storagePath.slice(0, firstSlash)
    const objectPath = payload.storagePath.slice(firstSlash + 1)

    const { data: file, error: dlErr } = await sb.storage.from(bucket).download(objectPath)
    if (dlErr || !file) {
      throw new Error(`storage download failed: ${dlErr?.message || 'unknown'}`)
    }
    const pdfBytes = new Uint8Array(await file.arrayBuffer())

    // IP real via X-Forwarded-For (chain "client, proxy1, proxy2"); pega o primeiro.
    const xff = req.headers.get('x-forwarded-for') || ''
    const realIp = xff.split(',')[0]?.trim() || 'desconhecido'

    const subLines = buildLines({
      name: payload.viewerId,
      email: payload.viewerEmail || auth.email,
      ip: realIp,
      timestamp: new Date().toISOString(),
    })

    const stamped = await stampPdf(pdfBytes, {
      text: 'CÓPIA NÃO CONTROLADA',
      subLines,
    })

    // Forensic audit (issue #14): registra 'downloaded' com IP real + user.
    // Best-effort: falha aqui não trava o download.
    if (payload.docId) {
      try {
        await sb.from('documento_changelog').insert({
          documento_id: payload.docId,
          action: 'downloaded',
          user_id: auth.sub,
          user_name: payload.viewerEmail || auth.email || auth.sub,
          user_email: payload.viewerEmail || auth.email || null,
          changes: { ip: realIp, watermarked: true },
        })
      } catch (auditErr) {
        console.warn('[watermark-pdf] changelog insert failed:', auditErr instanceof Error ? auditErr.message : auditErr)
      }
    }

    return new Response(stamped, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="watermarked-${payload.docId || 'doc'}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('watermark-pdf error:', message)
    const status = /authorization|token|jwt|key/i.test(message) ? 401 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
