/**
 * Smoke test do Edge Function ingest-uptodate.
 *
 * Envia 2 itens mock com HMAC-SHA256 e imprime a resposta.
 * Útil para validar que:
 *   1. A função está deployed e acessível.
 *   2. INGEST_UPTODATE_SECRET está corretamente seteado dos dois lados.
 *   3. O upsert funciona (1ª chamada insere, 2ª atualiza).
 *
 * Uso:
 *   INGEST_UPTODATE_URL=https://<ref>.supabase.co/functions/v1/ingest-uptodate \
 *   INGEST_SHARED_SECRET=<secret> \
 *   node smoke-ingest.mjs
 */
import crypto from 'node:crypto'
import { sanitizeUtdHtml, normalizeTitle, normalizeUrl } from './sanitize.mjs'

function dedupHashOf(url, titleNorm) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeUrl(url)}|${titleNorm}`, 'utf8')
    .digest('hex')
}

function buildItem({ titulo, body, urlPath, daysAgo = 0 }) {
  const url = `https://www.uptodate.com/contents/${urlPath}`
  const tnorm = normalizeTitle(titulo)
  const publicado = new Date(Date.now() - daysAgo * 86400000).toISOString()
  return {
    titulo,
    resumo_html: sanitizeUtdHtml(body),
    resumo_texto: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    topic_id: urlPath,
    fonte_url: url,
    categoria: 'anesthesiology',
    secao: "What's New in Anesthesiology",
    titulo_norm: tnorm,
    dedup_hash: dedupHashOf(url, tnorm),
    publicado_em: publicado,
  }
}

async function main() {
  const url = process.env.INGEST_UPTODATE_URL
  const secret = process.env.INGEST_SHARED_SECRET
  if (!url || !secret) {
    throw new Error('Definir INGEST_UPTODATE_URL e INGEST_SHARED_SECRET')
  }

  const items = [
    buildItem({
      titulo: 'SMOKE TEST — Sugammadex for routine reversal in pediatric anesthesia',
      body: '<p>Mock body com <strong>destaque</strong> e <a href="https://evil.test">link removido</a>. <ul><li>item 1</li><li>item 2</li></ul></p>',
      urlPath: 'smoke-sugammadex-pediatric',
      daysAgo: 1,
    }),
    buildItem({
      titulo: 'SMOKE TEST — Updated guidelines for difficult airway management',
      body: '<p>Outro body. <script>alert("xss")</script><iframe src="https://evil"></iframe></p>',
      urlPath: 'smoke-airway-management',
      daysAgo: 3,
    }),
  ]

  const body = JSON.stringify({ items })
  const signature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')

  console.log(`[smoke] POST ${url} (${items.length} items)`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-anest-signature': signature },
    body,
  })
  const text = await res.text()
  console.log(`[smoke] status: ${res.status}`)
  console.log(`[smoke] body: ${text}`)
  if (!res.ok) process.exit(1)

  console.log('[smoke] re-enviando (esperar updated, não inserted)...')
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-anest-signature': signature },
    body,
  })
  const text2 = await res2.text()
  console.log(`[smoke] status: ${res2.status}`)
  console.log(`[smoke] body: ${text2}`)
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err.message)
  process.exit(1)
})
