/**
 * PDFEmbed — embed de PDF via <iframe> nativo do browser, INLINE ONLY.
 *
 * Decisão de produto: o PDF deve ser visualizado APENAS dentro do app.
 * Para abrir externamente, o usuário usa os botões "Ver em PMC",
 * "Ver no PubMed" ou "Abrir na fonte" abaixo do resumo.
 *
 * Por que iframe e não react-pdf?
 *  - react-pdf usa fetch() para baixar o PDF → CORS bloqueia PMC, BJA, Wiley.
 *  - iframe usa o PDF viewer nativo do browser (chrome-pdf-viewer, etc.) →
 *    bypassa CORS porque é navegação, não fetch.
 *
 * Heurística para decidir embedar:
 *  - Só tenta se URL parece PDF direto (.pdf no fim ou /pdf/ no path).
 *  - URLs landing (doi.org, pmc/articles/PMCxxx/ sem /pdf/) NÃO são embedadas
 *    — mostra mensagem para usar os botões de ação abaixo.
 */
import { useState, useEffect, useRef } from 'react'
import { FileText, Inbox } from 'lucide-react'

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
  const [failed, setFailed] = useState(false)
  const [loadTimeout, setLoadTimeout] = useState(false)
  const iframeRef = useRef(null)

  const canEmbed = isLikelyDirectPdf(url)

  // Timeout: se iframe não disparar onLoad em 10s, assumimos falha (CSP / X-Frame-Options)
  useEffect(() => {
    if (!canEmbed) return
    const timer = setTimeout(() => setLoadTimeout(true), 10000)
    return () => clearTimeout(timer)
  }, [canEmbed, url])

  if (!url) return null

  // URL não parece PDF direto OU iframe falhou → mostra mensagem
  // (o usuário tem os botões de ação abaixo do resumo para acessar)
  if (!canEmbed || failed || loadTimeout) {
    return <FallbackBlock notDirect={!canEmbed} className={className} />
  }

  return (
    <div className={className}>
      {/* CRITICAL: sandbox SEM allow-popups e SEM allow-top-navigation —
          impede que o PDF abra páginas externas. allow-same-origin necessário
          para o viewer nativo funcionar; allow-scripts para zoom/navegação. */}
      <iframe
        ref={iframeRef}
        title={title}
        src={url}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        className="block w-full h-[70vh] min-h-[400px] border-0 bg-card"
        onLoad={() => setLoadTimeout(false)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function FallbackBlock({ notDirect, className }) {
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        {notDirect ? (
          <Inbox className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FileText className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="max-w-md">
          <p className="text-[14px] font-medium text-foreground">
            {notDirect
              ? 'Este artigo é Open Access mas requer acesso pela fonte original'
              : 'Não foi possível embutir o PDF aqui'}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1.5">
            Use os botões <strong className="text-foreground">Ver em PMC</strong>,
            {' '}<strong className="text-foreground">Ver no PubMed</strong> ou
            {' '}<strong className="text-foreground">Abrir na fonte</strong> abaixo
            do resumo para acessar a publicação completa.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PDFEmbed
export { isLikelyDirectPdf }
