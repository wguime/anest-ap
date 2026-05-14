/**
 * supabasePdfaService — Sprint 6 / Onda 2 / O2-3
 *
 * Cliente leve da edge function `pdfa-convert`:
 *   - requestPdfaConversion(docId, sourceStoragePath, jwt) — fire-and-forget
 *   - getSignedPdfaUrl(pdfaUrl) — gera signed URL para download
 *
 * Importante: a edge function consome service-role internamente. Daqui só
 * mandamos o JWT customizado do user (HS256) — ela valida via JWT_SECRET.
 */

import { supabase, getSupabaseToken } from '@/config/supabase'

const FUNCTION_NAME = 'pdfa-convert'
const PDFA_BUCKET = 'documentos-pdfa'
const SIGNED_URL_TTL_SECONDS = 60 * 5

// Cliente Supabase usa accessToken option (HS256 custom JWT), o que bloqueia
// supabase.auth.getSession(). getSupabaseToken() é o helper canônico do projeto.
async function getAuthToken() {
  return getSupabaseToken()
}

/**
 * Dispara conversão PDF/A na edge function. Fire-and-forget — retorna assim
 * que a edge function aceita o request (não espera o trabalho terminar).
 *
 * @param {string} documentoId
 * @param {string} sourceStoragePath - "bucket/path/to/file.pdf"
 * @returns {Promise<{queued: true} | {error: string}>}
 */
export async function requestPdfaConversion(documentoId, sourceStoragePath) {
  if (!documentoId || !sourceStoragePath) {
    throw new Error('requestPdfaConversion: documentoId e sourceStoragePath obrigatórios')
  }
  const jwt = await getAuthToken()
  if (!jwt) throw new Error('requestPdfaConversion: sem JWT (user não autenticado)')

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { documentoId, sourceStoragePath },
    headers: { Authorization: `Bearer ${jwt}` },
  })

  if (error) return { error: error.message || 'pdfa-convert falhou' }
  return data ?? { queued: true }
}

/**
 * Gera signed URL para download do PDF/A. Bucket é privado.
 *
 * @param {string} pdfaUrl - "documentos-pdfa/<docId>/<file>.pdf"
 * @returns {Promise<string|null>}
 */
export async function getSignedPdfaUrl(pdfaUrl) {
  if (!pdfaUrl) return null
  const prefix = `${PDFA_BUCKET}/`
  const path = pdfaUrl.startsWith(prefix) ? pdfaUrl.slice(prefix.length) : pdfaUrl
  const { data, error } = await supabase.storage
    .from(PDFA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) {
    console.warn('[pdfaService] signed url failed:', error.message)
    return null
  }
  return data?.signedUrl || null
}

const supabasePdfaService = {
  requestPdfaConversion,
  getSignedPdfaUrl,
  PDFA_BUCKET,
  SIGNED_URL_TTL_SECONDS,
}

export default supabasePdfaService
