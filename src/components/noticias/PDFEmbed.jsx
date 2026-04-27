/**
 * PDFEmbed — embed de PDF via <iframe> nativo do browser.
 *
 * Por que iframe e não react-pdf?
 *  - react-pdf usa fetch() para baixar o PDF → CORS bloqueia PMC, BJA, etc.
 *  - iframe usa o PDF viewer nativo do browser (chrome-pdf-viewer, etc.) →
 *    bypassa CORS porque é navegação, não fetch.
 *
 * Heurística para decidir embedar:
 *  - Só tenta se URL parece PDF direto (.pdf no fim ou /pdf/ no path).
 *  - Landing pages (doi.org/, pmc/articles/PMCxxx/ sem /pdf/) NÃO são embedadas
 *    — mostra fallback com botão "Abrir artigo" pois iframe mostraria HTML
 *    da landing, não o PDF.
 *
 * Mesmo PDFs diretos podem falhar (X-Frame-Options ou CSP do servidor).
 * Por isso o user sempre tem botão de fallback "Abrir em nova aba".
 */
import { useState, useEffect, useRef } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { Button } from '@/design-system'

function isLikelyDirectPdf(url) {
  if (!url || typeof url !== 'string') return false
  const u = url.toLowerCase().split('?')[0].split('#')[0]
  if (u.endsWith('.pdf')) return true
  if (u.endsWith('/pdf') || u.endsWith('/pdf/')) return true
  if (u.includes('/pdf/')) return true
  // Caso PMC: .../articles/PMCxxx/pdf/...
  if (/pmc\.ncbi\.nlm\.nih\.gov\/articles\/pmc\d+\/pdf/i.test(url)) return true
  // .../article/.../pdf (Elsevier/BJA pattern)
  if (/\/article\/[^?]+\/pdf(\?|$|\/)/i.test(url)) return true
  return false
}

export function PDFEmbed({ url, title = 'PDF do artigo', className }) {
  const [failed, setFailed] = useState(false)
  const [loadTimeout, setLoadTimeout] = useState(false)
  const iframeRef = useRef(null)

  const canEmbed = isLikelyDirectPdf(url)

  // Timeout: se iframe não disparar onLoad em 8s, assumimos falha
  useEffect(() => {
    if (!canEmbed) return
    const timer = setTimeout(() => setLoadTimeout(true), 8000)
    return () => clearTimeout(timer)
  }, [canEmbed, url])

  if (!url) return null

  // URL não parece ser PDF direto (provavelmente landing page)
  if (!canEmbed) {
    return (
      <FallbackBlock url={url} reason="landing" className={className} />
    )
  }

  // Iframe falhou via timeout ou onError
  if (failed || loadTimeout) {
    return <FallbackBlock url={url} reason="blocked" className={className} />
  }

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        title={title}
        src={url}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
        className="block w-full h-[70vh] min-h-[400px] border-0 bg-card"
        onLoad={() => setLoadTimeout(false)}
        onError={() => setFailed(true)}
      />
      <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-card">
        <span className="text-[11px] text-muted-foreground">
          Se o PDF não carregar, use o botão ao lado.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir em nova aba
        </Button>
      </div>
    </div>
  )
}

function FallbackBlock({ url, reason, className }) {
  const isLanding = reason === 'landing'
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileText className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-[14px] font-medium text-foreground">
            {isLanding
              ? 'Este artigo é Open Access mas requer abrir o site da fonte'
              : 'Não foi possível embutir o PDF aqui'}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {isLanding
              ? 'A página de origem hospeda o PDF — clique para acessar.'
              : 'O servidor da fonte bloqueou a visualização inline. O conteúdo está disponível em nova aba.'}
          </p>
        </div>
        <Button
          variant="default"
          className="gap-2"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="w-4 h-4" />
          Abrir artigo na fonte
        </Button>
      </div>
    </div>
  )
}

export default PDFEmbed
export { isLikelyDirectPdf }
