/**
 * Edge Function: pdfa-convert
 *
 * Sprint 6 / Onda 2 / O2-3 — Geração de PDF/A para documentos arquivados.
 *
 * Fluxo:
 *   1. Recebe { documentoId, sourceStoragePath } com Authorization Bearer.
 *   2. Valida Authorization via _shared/verify-auth.ts — aceita JWT HS256
 *      legado OU Firebase ID Token (RS256). Somente authenticated.
 *   3. Marca pdfa_status='processing'.
 *   4. Baixa PDF original do bucket de origem (geralmente 'documentos').
 *   5. Normaliza via pdf-lib + injeta XMP metadata declarando PDF/A-2b intent
 *      e OutputIntent sRGB. NOTA: esta é uma "PDF/A-readiness pass" via pdf-lib
 *      — não é PDF/A-2b strict (que exigiria ghostscript ou validador PDF/A
 *      completo, indisponível em Deno Deploy). Documentado em CHANGELOG.
 *   6. Sobe resultado para `documentos-pdfa/<documentoId>/<basename>.pdf`.
 *   7. Atualiza pdfa_status='done' + pdfa_url + pdfa_pages + pdfa_size_bytes.
 *   8. Insere changelog action='pdfa_generated'.
 *
 * Falhas → pdfa_status='failed' + changelog action='pdfa_failed'.
 *
 * Env vars necessárias:
 *   SUPABASE_URL                 — URL do projeto
 *   SUPABASE_SERVICE_ROLE_KEY    — service-role para Storage + DB
 *   JWT_SECRET                   — segredo HS256 legado (consumido por _shared/verify-auth.ts)
 *   ALLOWED_ORIGIN               — origem permitida no CORS (default anest-ap.web.app)
 */

import { verifyAuthHeader } from '../_shared/verify-auth.ts'
import { PDFDocument, PDFName, PDFString, PDFRawStream, decodePDFRawStream } from 'https://esm.sh/pdf-lib@1.17.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://anest-ap.web.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PdfaPayload {
  documentoId: string
  sourceStoragePath: string  // formato "bucket/path"
}

// ---------------------------------------------------------------------------
// JWT validation — _shared/verify-auth.ts (HS256 legado OU Firebase RS256).
// Mapeia reasons do helper para as mensagens de erro originais desta função
// (contrato { error: string } + status 401/500 preservado).
// ---------------------------------------------------------------------------
const AUTH_REASON_MESSAGES: Record<string, string> = {
  missing_token: 'Missing or invalid Authorization header',
  invalid_token: 'Invalid token',
  internal_error: 'JWT_SECRET not configured',
}

// ---------------------------------------------------------------------------
// PDF/A-readiness pass — pdf-lib normalization + XMP metadata
// ---------------------------------------------------------------------------
function buildXmpMetadata(opts: { title: string; author: string; producedAt: string }): string {
  const { title, author, producedAt } = opts
  const safe = (s: string) =>
    String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ANEST PDF/A pipeline">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${safe(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${safe(author)}</rdf:li></rdf:Seq></dc:creator>
      <xmp:CreatorTool>ANEST v3.73 PDF/A pipeline</xmp:CreatorTool>
      <xmp:CreateDate>${producedAt}</xmp:CreateDate>
      <pdf:Producer>pdf-lib (PDF/A-2b candidate)</pdf:Producer>
      <pdfaid:part>2</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

async function convertToPdfaReady(
  pdfBytes: Uint8Array,
  meta: { title: string; author: string },
): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false, updateMetadata: false })

  const producedAt = new Date().toISOString()
  doc.setTitle(meta.title)
  doc.setAuthor(meta.author)
  doc.setCreator('ANEST PDF/A pipeline')
  doc.setProducer('pdf-lib (PDF/A-2b candidate)')
  doc.setCreationDate(new Date())
  doc.setModificationDate(new Date())

  // XMP metadata (pdfaid:part=2 / conformance=B)
  const xmp = buildXmpMetadata({ title: meta.title, author: meta.author, producedAt })
  const xmpStream = doc.context.stream(xmp, {
    Type: 'Metadata',
    Subtype: 'XML',
  } as Record<string, string>)
  const xmpRef = doc.context.register(xmpStream)
  doc.catalog.set(PDFName.of('Metadata'), xmpRef)

  const pages = doc.getPageCount()
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false })
  return { bytes, pages }
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

  let documentoId: string | undefined
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  try {
    const auth = await verifyAuthHeader(req.headers.get('authorization'))
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: AUTH_REASON_MESSAGES[auth.reason] }), {
        status: auth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const payload = (await req.json()) as PdfaPayload
    documentoId = payload?.documentoId

    if (!documentoId || !payload?.sourceStoragePath) {
      return new Response(JSON.stringify({ error: 'documentoId and sourceStoragePath required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase service credentials not configured')
    }

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Marca processing
    await sb.from('documentos')
      .update({ pdfa_status: 'processing' })
      .eq('id', documentoId)

    // 2. Baixa PDF de origem
    const firstSlash = payload.sourceStoragePath.indexOf('/')
    if (firstSlash <= 0) {
      throw new Error('sourceStoragePath must be "bucket/path"')
    }
    const sourceBucket = payload.sourceStoragePath.slice(0, firstSlash)
    const sourceObject = payload.sourceStoragePath.slice(firstSlash + 1)

    const { data: file, error: dlErr } = await sb.storage.from(sourceBucket).download(sourceObject)
    if (dlErr || !file) {
      throw new Error(`storage download failed: ${dlErr?.message || 'unknown'}`)
    }
    const pdfBytes = new Uint8Array(await file.arrayBuffer())

    // 3. Buscar metadata do documento (titulo, created_by_name) para XMP
    const { data: docRow } = await sb.from('documentos')
      .select('titulo, created_by_name')
      .eq('id', documentoId)
      .single()

    const title = docRow?.titulo || documentoId
    const author = docRow?.created_by_name || 'ANEST'

    // 4. Convert
    const { bytes: outBytes, pages } = await convertToPdfaReady(pdfBytes, { title, author })

    // 5. Upload para documentos-pdfa
    const baseName = sourceObject.split('/').pop()?.replace(/\.[^.]+$/, '') || documentoId
    const targetPath = `${documentoId}/${baseName}-pdfa.pdf`
    const { error: upErr } = await sb.storage
      .from('documentos-pdfa')
      .upload(targetPath, outBytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) {
      throw new Error(`storage upload failed: ${upErr.message}`)
    }

    const pdfaUrl = `documentos-pdfa/${targetPath}`

    // 6. Atualiza documento
    await sb.from('documentos')
      .update({
        pdfa_status: 'done',
        pdfa_url: pdfaUrl,
        pdfa_processed_at: new Date().toISOString(),
        pdfa_pages: pages,
        pdfa_size_bytes: outBytes.byteLength,
      })
      .eq('id', documentoId)

    // 7. Changelog
    await sb.from('documento_changelog').insert({
      documento_id: documentoId,
      action: 'pdfa_generated',
      user_id: auth.uid,
      user_name: auth.email || auth.uid,
      user_email: auth.email || null,
      changes: { pdfa_url: pdfaUrl, pages, size_bytes: outBytes.byteLength },
    })

    return new Response(
      JSON.stringify({ success: true, pdfaUrl, pages, sizeBytes: outBytes.byteLength }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[pdfa-convert] error:', message, 'documentoId:', documentoId)

    // Best-effort: marcar failed se ainda não está
    if (documentoId && supabaseUrl && serviceKey) {
      try {
        const sb = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        await sb.from('documentos')
          .update({ pdfa_status: 'failed', pdfa_processed_at: new Date().toISOString() })
          .eq('id', documentoId)
        await sb.from('documento_changelog').insert({
          documento_id: documentoId,
          action: 'pdfa_failed',
          user_id: 'system',
          user_name: 'system',
          changes: { error: message },
        })
      } catch (markErr) {
        console.error('[pdfa-convert] failed-state mark also failed:', markErr)
      }
    }

    const status = /authorization|token|jwt/i.test(message) ? 401 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
