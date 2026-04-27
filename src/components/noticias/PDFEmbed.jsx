/**
 * PDFEmbed — embed de PDF via <iframe> nativo do browser, INLINE ONLY.
 *
 * Estratégia validada pelo mercado (Read by QxMD, BrowZine, Mendeley, Papers):
 * apps profissionais NÃO tentam embedar PDFs cross-origin sem login institucional.
 *
 *  - Se URL é PDF direto (`/pdf/...` ou `.pdf`) e iframe carrega → mostra inline.
 *  - Se URL não é PDF direto OU iframe falha (X-Frame-Options/CSP) → retorna null
 *    (esconde a section silenciosamente). User acessa via botões "Ver em PMC" /
 *    "Ver no PubMed" / "Abrir na fonte" / "Copiar DOI" abaixo do resumo.
 *
 * Decisão de produto:
 *  - SEM mensagem de erro / fallback visual.
 *  - SEM botão "Abrir em nova aba" no viewer (somente os 4 botões oficiais).
 *  - Iframe com fade-in: invisível durante carregamento, aparece quando pronto.
 */
import { useState, useEffect, useRef } from 'react'
import { Skeleton } from '@/design-system'

function isLikelyDirectPdf(url) {
  if (!url || typeof url !== 'string') return false
  const u = url.toLowerCase().split('?')[0].split('#')[0]
  if (u.endsWith('.pdf')) return true
  if (u.endsWith('/pdf') || u.endsWith('/pdf/')) return true
  if (u.includes('/pdf/')) return true
  if (/pmc\.ncbi\.nlm\.nih\.gov\/articles\/pmc\d+\/pdf/i.test(url)) return true
  if (/\/article\/[^?]+\/pdf(\?|$|\/)/i.test(url)) return true
  return false
}

export function PDFEmbed({ url, title = 'PDF do artigo', className }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const iframeRef = useRef(null)

  const canEmbed = isLikelyDirectPdf(url)

  // Timeout: se iframe não disparar onLoad em 12s, considera falhou
  // (CSP frame-ancestors / X-Frame-Options). Esconde silenciosamente.
  useEffect(() => {
    if (!canEmbed || loaded) return
    const timer = setTimeout(() => {
      if (!loaded) setFailed(true)
    }, 12000)
    return () => clearTimeout(timer)
  }, [canEmbed, url, loaded])

  // URL não embedável OU iframe falhou → esconde section inteira
  if (!url || !canEmbed || failed) return null

  return (
    <div className={className}>
      {/* Skeleton enquanto iframe carrega; iframe começa invisível */}
      {!loaded && (
        <div className="w-full h-[70vh] min-h-[400px] flex items-center justify-center bg-card">
          <Skeleton className="w-full h-full rounded-2xl" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        title={title}
        src={url}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        className="block w-full h-[70vh] min-h-[400px] border-0 bg-card transition-opacity duration-200"
        style={{
          opacity: loaded ? 1 : 0,
          position: loaded ? 'static' : 'absolute',
          pointerEvents: loaded ? 'auto' : 'none',
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export default PDFEmbed
export { isLikelyDirectPdf }
