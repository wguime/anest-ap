/**
 * Envia payload para a Edge Function `ingest-uptodate` autenticando
 * com HMAC-SHA256 do body usando o shared secret.
 */
import crypto from 'node:crypto'

export async function postIngest(items) {
  const url = process.env.INGEST_UPTODATE_URL
  const secret = process.env.INGEST_SHARED_SECRET
  if (!url) throw new Error('INGEST_UPTODATE_URL ausente')
  if (!secret) throw new Error('INGEST_SHARED_SECRET ausente')

  const body = JSON.stringify({ items })
  const signature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-anest-signature': signature,
    },
    body,
  })

  const text = await res.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text }
  }
  if (!res.ok) {
    throw new Error(`Ingest falhou (${res.status}): ${text}`)
  }
  return parsed
}
