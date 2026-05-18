/**
 * NoticiaDetalhePage — detalhe de uma notícia.
 *
 *  - Header padrão (createPortal).
 *  - Badges DS: revista (default subtle) | tipo (secondary) | OA (success).
 *  - Título PT em destaque com border-l-primary; título original em itálico abaixo.
 *  - Autores em linha simples.
 *  - Abstract estruturado (BACKGROUND/METHODS/RESULTS/CONCLUSIONS) quando detectado.
 *  - Estado A (OA): PDFViewer inline.
 *  - Estado B (paywall): só abstract.
 *  - Botões grid 2-col: PMC | PubMed | Fonte | Copiar DOI.
 *  - Metadados expandíveis: categoria, tipo, citações, score, DOI, PMID, MeSH top 10.
 */
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ExternalLink, Newspaper, Calendar, Copy, CheckCheck, BookOpen, Lock, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useNoticias } from '@/contexts/NoticiasContext'
import { Button, Skeleton, EmptyState } from '@/design-system'
import { Badge } from '@/design-system/components/ui/badge'
import { PDFEmbed } from '@/components/noticias/PDFEmbed'
import { cn } from '@/design-system/utils/tokens'

function formatFullDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const SECTION_LABELS = [
  // EN
  ['BACKGROUND', 'Introdução'],
  ['INTRODUCTION', 'Introdução'],
  ['OBJECTIVES?', 'Objetivos'],
  ['AIMS?', 'Objetivos'],
  ['METHODS?', 'Métodos'],
  ['DESIGN', 'Desenho'],
  ['SETTING', 'Local'],
  ['PARTICIPANTS', 'Participantes'],
  ['INTERVENTIONS?', 'Intervenções'],
  ['MEASUREMENTS', 'Medidas'],
  ['RESULTS?', 'Resultados'],
  ['FINDINGS', 'Achados'],
  ['CONCLUSIONS?', 'Conclusões'],
  ['DISCUSSION', 'Discussão'],
  ['IMPLICATIONS', 'Implicações'],
  // PT
  ['INTRODUÇÃO', 'Introdução'],
  ['OBJETIVOS?', 'Objetivos'],
  ['MÉTODOS?', 'Métodos'],
  ['RESULTADOS?', 'Resultados'],
  ['CONCLUSÕES?', 'Conclusões'],
]

function parseStructuredAbstract(text) {
  if (!text || typeof text !== 'string') return null
  const labels = SECTION_LABELS.map(([k]) => k).join('|')
  const re = new RegExp(`(?:^|\\n)\\s*(${labels})\\s*[:.]\\s*`, 'gi')
  const matches = [...text.matchAll(re)]
  if (matches.length < 2) return null

  const sections = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const next = matches[i + 1]
    const start = m.index + m[0].length
    const end = next ? next.index : text.length
    const rawLabel = m[1].toUpperCase().replace(/S\?$/, 'S')
    const localized =
      SECTION_LABELS.find(([k]) => k.replace(/\?$/, '').toUpperCase() === rawLabel.replace(/S$/, ''))?.[1] ||
      m[1].toLowerCase().replace(/^./, (c) => c.toUpperCase())
    sections.push({
      label: localized,
      body: text.slice(start, end).trim(),
    })
  }
  return sections.length >= 2 ? sections : null
}

export default function NoticiaDetalhePage({ noticiaId, onNavigate, goBack }) {
  const { getById } = useNoticias()
  const [noticia, setNoticia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showMeta, setShowMeta] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    let alive = true
    setLoading(true)
    getById(noticiaId).then((n) => {
      if (alive) {
        setNoticia(n)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [noticiaId, getById])

  const tituloPt = noticia?.tituloPt || noticia?.titulo || ''
  const tituloOriginal = noticia?.tituloPt && noticia?.titulo && noticia.tituloPt !== noticia.titulo
    ? noticia.titulo
    : null
  const resumoPt = noticia?.resumoPt || noticia?.resumo || ''
  const isOA = Boolean(noticia?.oaPdfUrl || noticia?.pmcId)

  const structured = useMemo(() => parseStructuredAbstract(resumoPt), [resumoPt])

  const handleCopyDoi = async () => {
    if (!noticia?.doi) return
    try {
      await navigator.clipboard.writeText(noticia.doi)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignora
    }
  }

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('noticias'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {noticia?.fonte || 'Publicação'}
          </h1>
          <div className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 pt-4 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !noticia ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title="Notícia não encontrada"
            description="Esta notícia pode ter sido removida."
          />
        ) : (
          <article className="flex flex-col gap-4">
            {/* Hero meta + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" badgeStyle="subtle">{noticia.fonte}</Badge>
              {noticia.articleType && (
                <Badge variant="secondary" badgeStyle="subtle">{noticia.articleType}</Badge>
              )}
              {isOA ? (
                <Badge variant="success" badgeStyle="subtle" className="gap-1">
                  <BookOpen className="h-3 w-3" aria-hidden="true" />
                  Open Access
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Acesso restrito
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {formatFullDate(noticia.publicadoEm)}
              </span>
            </div>

            {/* Título com border-l-primary */}
            <div className="border-l-4 border-l-primary pl-3 py-1">
              <h2 className="text-xl lg:text-2xl font-bold leading-tight text-foreground">
                {tituloPt}
              </h2>
              {tituloOriginal && (
                <p className="text-sm italic text-muted-foreground mt-1">
                  {tituloOriginal}
                </p>
              )}
            </div>

            {/* Autores */}
            {noticia.autores && (
              <p className="text-sm text-muted-foreground">{noticia.autores}</p>
            )}

            {/* Abstract — tipografia otimizada para leitura científica */}
            {structured ? (
              <div className="rounded-xl border border-border bg-card p-5 lg:p-7 flex flex-col gap-6">
                {structured.map((sec, i) => (
                  <section key={i} className="flex flex-col gap-2">
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-primary">
                      {sec.label}
                    </h3>
                    <p className="text-[16px] lg:text-[17px] leading-[1.8] text-foreground whitespace-pre-line">
                      {sec.body}
                    </p>
                  </section>
                ))}
              </div>
            ) : resumoPt ? (
              <div className="rounded-xl border border-border bg-card p-5 lg:p-7">
                <p className="text-[16px] lg:text-[17px] leading-[1.8] text-foreground whitespace-pre-line">
                  {resumoPt}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border border-dashed bg-card p-5 lg:p-6">
                <p className="text-[13px] text-muted-foreground italic">
                  Este artigo não tem resumo disponível no PubMed.
                  {noticia.autores && (
                    <>
                      {' '}Autores: <span className="not-italic text-foreground">{noticia.autores}</span>.
                    </>
                  )}
                  {' '}Use os botões abaixo para acessar o conteúdo completo.
                </p>
              </div>
            )}

            {/* PDF / artigo OA — usa iframe nativo do browser (bypassa CORS).
                Detecta URLs que não são PDFs diretos (DOIs, landings) e mostra
                fallback CTA "Abrir artigo na fonte" automaticamente. */}
            {noticia.oaPdfUrl && (
              <section
                aria-label="PDF do artigo (Open Access)"
                className="rounded-xl overflow-hidden border border-border bg-card"
              >
                <PDFEmbed url={noticia.oaPdfUrl} title={noticia.tituloPt || noticia.titulo} />
              </section>
            )}

            {/* Botões 2-col — únicas saídas externas permitidas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {noticia.pmcId && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(`https://www.ncbi.nlm.nih.gov/pmc/articles/${noticia.pmcId}/`, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver em PMC
                </Button>
              )}
              {noticia.pmid && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(`https://pubmed.ncbi.nlm.nih.gov/${noticia.pmid}/`, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver no PubMed
                </Button>
              )}
              {(noticia.fonteUrl || noticia.rawUrl) && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(noticia.rawUrl || noticia.fonteUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir na fonte
                </Button>
              )}
              {noticia.doi && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleCopyDoi}
                >
                  {copied ? <CheckCheck className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'DOI copiado' : 'Copiar DOI'}
                </Button>
              )}
            </div>

            {/* Metadados (collapsible) */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMeta((s) => !s)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/40 transition-colors"
                aria-expanded={showMeta}
              >
                <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Metadados
                </span>
                {showMeta ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {showMeta && (
                <dl className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                  {noticia.category && (
                    <div>
                      <dt className="text-muted-foreground">Categoria</dt>
                      <dd className="text-foreground font-medium">{noticia.category}</dd>
                    </div>
                  )}
                  {noticia.articleType && (
                    <div>
                      <dt className="text-muted-foreground">Tipo</dt>
                      <dd className="text-foreground font-medium">{noticia.articleType}</dd>
                    </div>
                  )}
                  {typeof noticia.citationCount === 'number' && (
                    <div>
                      <dt className="text-muted-foreground">Citações</dt>
                      <dd className="text-foreground font-medium">{noticia.citationCount}</dd>
                    </div>
                  )}
                  {typeof noticia.finalScore === 'number' && (
                    <div>
                      <dt className="text-muted-foreground">Score</dt>
                      <dd className="text-foreground font-medium">{Math.round(noticia.finalScore)}</dd>
                    </div>
                  )}
                  {noticia.doi && (
                    <div className="sm:col-span-2 break-all">
                      <dt className="text-muted-foreground">DOI</dt>
                      <dd className="text-foreground font-mono text-[12px]">{noticia.doi}</dd>
                    </div>
                  )}
                  {noticia.pmid && (
                    <div>
                      <dt className="text-muted-foreground">PMID</dt>
                      <dd className="text-foreground font-mono text-[12px]">{noticia.pmid}</dd>
                    </div>
                  )}
                  {Array.isArray(noticia.meshTerms) && noticia.meshTerms.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Termos MeSH</dt>
                      <dd className="text-foreground text-[12px] flex flex-wrap gap-1 mt-1">
                        {noticia.meshTerms.slice(0, 10).map((t, i) => (
                          <span
                            key={i}
                            className={cn(
                              'inline-block px-2 py-0.5 rounded-md bg-muted text-muted-foreground',
                              'text-[11px]',
                            )}
                          >
                            {t}
                          </span>
                        ))}
                        {noticia.meshTerms.length > 10 && (
                          <span className="text-[11px] text-muted-foreground self-center">
                            +{noticia.meshTerms.length - 10} mais
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}
