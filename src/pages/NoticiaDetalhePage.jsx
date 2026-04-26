import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import DOMPurify from 'dompurify'
import { ChevronLeft, ExternalLink, Newspaper, User, Calendar } from 'lucide-react'
import { useNoticias } from '@/contexts/NoticiasContext'
import { Button, Skeleton, EmptyState } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

const CATEGORIA_COLOR = {
  pesquisa: 'category-blue',
  sociedade: 'category-teal',
  clinica: 'category-purple',
  noticia: 'category-orange',
}

function formatFullDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  const months = Math.floor(days / 30)
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
}

export default function NoticiaDetalhePage({ noticiaId, onNavigate, goBack }) {
  const { getById } = useNoticias()
  const [noticia, setNoticia] = useState(null)
  const [loading, setLoading] = useState(true)

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
    return () => { alive = false }
  }, [noticiaId, getById])

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('noticias'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Notícia
          </h1>
          <div className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
    </nav>
  )

  const handleOpenSource = (url) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

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
          <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold uppercase tracking-wide',
                  `bg-${CATEGORIA_COLOR[noticia.categoria] || 'category-blue'}-bg`,
                  `text-${CATEGORIA_COLOR[noticia.categoria] || 'category-blue'}-fg`
                )}
              >
                <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
                {noticia.fonte}
              </span>
              {noticia.categoria && (
                <span className="text-[12px] font-medium text-muted-foreground capitalize px-2 py-1 rounded-md bg-muted">
                  {noticia.categoria}
                </span>
              )}
              {noticia.idioma && (
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  {noticia.idioma}
                </span>
              )}
            </div>

            {/* Título */}
            <h2 className="text-xl lg:text-2xl font-bold leading-tight text-foreground">
              {noticia.titulo}
            </h2>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                {formatFullDate(noticia.publicadoEm)}
                <span className="opacity-60">({formatRelative(noticia.publicadoEm)})</span>
              </span>
              {noticia.autores && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-4 h-4" aria-hidden="true" />
                  {noticia.autores}
                </span>
              )}
            </div>

            {/* Resumo */}
            {noticia.resumo && (
              <div className="rounded-2xl border border-border bg-card p-4 lg:p-5">
                <p
                  className="text-[15px] leading-relaxed text-foreground whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(noticia.resumo, { ALLOWED_TAGS: [] }),
                  }}
                />
              </div>
            )}

            {/* CTA fonte */}
            <div className="flex justify-start">
              <Button
                onClick={() => handleOpenSource(noticia.rawUrl || noticia.fonteUrl)}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ler na fonte original
              </Button>
            </div>

            {/* Fontes extras */}
            {Array.isArray(noticia.fontesExtras) && noticia.fontesExtras.length > 0 && (
              <div className="mt-2">
                <p className="text-[13px] font-medium text-muted-foreground mb-2">
                  Também publicado em:
                </p>
                <div className="flex flex-wrap gap-2">
                  {noticia.fontesExtras.map((f, idx) => (
                    <button
                      key={`${f.fonte}-${idx}`}
                      type="button"
                      onClick={() => handleOpenSource(f.url)}
                      className="inline-flex items-center gap-1 px-3 h-8 min-h-[32px] rounded-full border border-border bg-card text-[12px] font-medium text-foreground hover:bg-accent/40 transition-colors"
                    >
                      {f.fonte}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.article>
        )}
      </div>
    </div>
  )
}
