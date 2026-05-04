/**
 * UptodateDetalhePage — visualizador embutido de um tópico UpToDate.
 *
 * Render do HTML:
 *   - Sanitização DUPLA: o scraper já limpou; aqui sanitizamos de novo
 *     em runtime (defesa em profundidade).
 *   - Tags permitidas: estrutura textual (p, h1-h6, ul, li, strong, etc) + tabelas.
 *   - Tags banidas: a, script, style, iframe, object, embed, form, input, button.
 *   - Atributos banidos: href, src, on*, style, target, rel.
 *
 * Defesa em profundidade contra navegação externa:
 *   listener de click em capture intercepta qualquer <a> ou [data-was-link]
 *   que tenha sobrevivido à sanitização e bloqueia preventDefault.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, BookMarked, Calendar } from 'lucide-react'
import DOMPurify from 'dompurify'

import { useUptodate } from '@/contexts/UptodateContext'
import { Skeleton, EmptyState, Badge } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

function formatFullDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'strong', 'em', 'b', 'i', 'u', 'br', 'span',
    'sup', 'sub',
    'div', 'section', 'article',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'figure', 'figcaption', 'blockquote',
  ],
  FORBID_TAGS: ['a', 'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'video', 'audio', 'source', 'svg'],
  ALLOWED_ATTR: ['class', 'data-was-link'],
  FORBID_ATTR: ['href', 'src', 'srcset', 'style', 'target', 'rel', 'onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'id'],
  KEEP_CONTENT: true,
}

export default function UptodateDetalhePage({ topicId, onNavigate, goBack }) {
  const { byId, getById } = useUptodate()
  const [topic, setTopic] = useState(byId?.[topicId] || null)
  const [loading, setLoading] = useState(!topic || topic.resumoHtml === undefined)
  const [error, setError] = useState(null)
  const articleRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [topicId])

  useEffect(() => {
    let cancelled = false
    if (!topicId) return
    if (topic && topic.resumoHtml !== undefined) {
      setLoading(false)
      return
    }
    setLoading(true)
    getById(topicId)
      .then((data) => {
        if (cancelled) return
        if (!data) setError('Tópico não encontrado.')
        setTopic(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [topicId, getById, topic])

  const cleanHtml = useMemo(() => {
    if (!topic?.resumoHtml) return ''
    return DOMPurify.sanitize(topic.resumoHtml, SANITIZE_CONFIG)
  }, [topic?.resumoHtml])

  // Defesa em profundidade: bloqueia clicks em <a> ou [data-was-link]
  useEffect(() => {
    const el = articleRef.current
    if (!el) return
    const onClick = (e) => {
      const t = e.target
      if (t && typeof t.closest === 'function') {
        const blocked = t.closest('a, [data-was-link]')
        if (blocked) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }
    el.addEventListener('click', onClick, true)
    return () => el.removeEventListener('click', onClick, true)
  }, [cleanHtml])

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate?.('uptodate'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            UpToDate
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
            <Skeleton className="h-8 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        ) : error || !topic ? (
          <EmptyState
            icon={<BookMarked className="w-10 h-10" />}
            title="Não foi possível abrir este tópico"
            description={error || 'Tente novamente mais tarde.'}
          />
        ) : (
          <>
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="default" badgeStyle="subtle" className="text-[10px] uppercase">
                UpToDate
              </Badge>
              {topic.secao && (
                <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
                  {topic.secao}
                </Badge>
              )}
              {topic.publicadoEm && (
                <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {formatFullDate(topic.publicadoEm)}
                </span>
              )}
            </div>

            {/* Título */}
            <h2 className="text-[20px] md:text-[22px] font-bold leading-tight text-foreground border-l-4 border-l-primary pl-3 mb-4">
              {topic.titulo}
            </h2>

            {/* Conteúdo sanitizado */}
            <article
              ref={articleRef}
              data-slot="uptodate-content"
              className={cn(
                'prose prose-sm max-w-none text-foreground',
                '[&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-[14px]',
                '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-[18px] [&_h1]:font-bold',
                '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[16px] [&_h2]:font-bold',
                '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold',
                '[&_ul]:my-3 [&_ul]:pl-5 [&_ul]:list-disc',
                '[&_ol]:my-3 [&_ol]:pl-5 [&_ol]:list-decimal',
                '[&_li]:my-1 [&_li]:text-[14px] [&_li]:leading-relaxed',
                '[&_strong]:font-semibold [&_em]:italic',
                '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse',
                '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:text-left [&_th]:text-[13px]',
                '[&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:text-[13px]',
                '[&_blockquote]:border-l-4 [&_blockquote]:border-l-border [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
                '[&_[data-was-link]]:underline [&_[data-was-link]]:decoration-dotted [&_[data-was-link]]:cursor-default',
              )}
              dangerouslySetInnerHTML={{ __html: cleanHtml || '<p class="text-muted-foreground">Sem conteúdo disponível.</p>' }}
            />

            {/* Footer */}
            <div className="mt-8 border-t border-border pt-4 text-[12px] text-muted-foreground">
              Conteúdo proveniente de UpToDate® — exibição somente leitura. Os links foram desabilitados.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
