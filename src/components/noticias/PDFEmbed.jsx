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
  // Heurística estrita: SOMENTE URLs que terminam em ".pdf" literalmente.
  // Patterns como "/pdf/" sem filename redirecionam para landing page e
  // disparam o ícone "broken file" do browser (X-Frame-Options bloqueia
  // tanto a landing quanto o redirect dela).
  if (!url || typeof url !== 'string') return false
  const u = url.toLowerCase().split('?')[0].split('#')[0]
  return u.endsWith('.pdf')
}

export function PDFEmbed({ url, title = 'PDF do artigo', className }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const mountTimeRef = useRef(0)
  const iframeRef = useRef(null)

  const canEmbed = isLikelyDirectPdf(url)

  useEffect(() => {
    if (!canEmbed) return
    mountTimeRef.current = Date.now()
    // Timeout: se iframe não disparar onLoad em 12s, considera falhou
    // (CSP frame-ancestors / X-Frame-Options). Esconde silenciosamente.
    const timer = setTimeout(() => {
      if (!loaded) setFailed(true)
    }, 12000)
    return () => clearTimeout(timer)
  }, [canEmbed, url, loaded])

  // URL não embedável OU iframe falhou → esconde section inteira
  if (!url || !canEmbed || failed) return null

  // Detecção heurística de "carregou mas é página de erro do browser":
  // X-Frame-Options/CSP block faz onLoad disparar QUASE imediato (<300ms)
  // com o iframe mostrando o ícone broken-file nativo. Real PDFs levam 800ms+.
  const handleLoad = () => {
    const elapsed = Date.now() - mountTimeRef.current
    if (elapsed < 300) {
      // Provavelmente bloqueado pelo browser — esconde
      setFailed(true)
      return
    }
    setLoaded(true)
  }

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
        onLoad={handleLoad}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export default PDFEmbed
export { isLikelyDirectPdf }
