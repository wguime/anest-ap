import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Search, RefreshCw, Newspaper } from 'lucide-react'
import { useNoticias } from '@/contexts/NoticiasContext'
import { NoticiaCard } from '@/components/noticias/NoticiaCard'
import { EmptyState, Skeleton } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

const CATEGORIAS = [
  { value: 'all', label: 'Todas' },
  { value: 'pesquisa', label: 'Pesquisa' },
  { value: 'sociedade', label: 'Sociedade' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'noticia', label: 'Notícia' },
]

export default function NoticiasPage({ onNavigate, goBack }) {
  const { noticias, loading, noticiasLoaded, loadNoticias } = useNoticias()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFontes, setSelectedFontes] = useState([])
  const [selectedCategoria, setSelectedCategoria] = useState('all')

  useEffect(() => {
    window.scrollTo(0, 0)
    loadNoticias()
  }, [loadNoticias])

  const fontesDisponiveis = useMemo(() => {
    const set = new Set(noticias.map((n) => n.fonte).filter(Boolean))
    return Array.from(set).sort()
  }, [noticias])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return noticias.filter((n) => {
      if (selectedFontes.length > 0 && !selectedFontes.includes(n.fonte)) return false
      if (selectedCategoria !== 'all' && n.categoria !== selectedCategoria) return false
      if (q) {
        const blob = `${n.titulo || ''} ${n.resumo || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [noticias, searchQuery, selectedFontes, selectedCategoria])

  const toggleFonte = (fonte) => {
    setSelectedFontes((prev) =>
      prev.includes(fonte) ? prev.filter((f) => f !== fonte) : [...prev, fonte]
    )
  }

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('home'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Central de Notícias
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={() => loadNoticias()}
              aria-label="Atualizar"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 pt-4">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative mb-3"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por título ou resumo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </motion.div>

        {/* Categoria tabs */}
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setSelectedCategoria(c.value)}
              className={cn(
                'px-3 h-9 min-h-[36px] rounded-full border text-[13px] font-medium transition-colors',
                selectedCategoria === c.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-accent/40'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Fontes chips */}
        {fontesDisponiveis.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {fontesDisponiveis.map((f) => {
              const active = selectedFontes.includes(f)
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFonte(f)}
                  aria-pressed={active}
                  className={cn(
                    'px-3 h-8 min-h-[32px] rounded-full border text-[12px] font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'bg-card text-muted-foreground border-border hover:bg-accent/40'
                  )}
                >
                  {f}
                </button>
              )
            })}
          </div>
        )}

        {/* Lista */}
        {loading && !noticiasLoaded ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title="Nenhuma notícia encontrada"
            description={
              noticias.length === 0
                ? 'As notícias são atualizadas diariamente. Volte mais tarde.'
                : 'Tente ajustar os filtros ou a busca.'
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((n) => (
              <NoticiaCard
                key={n.id}
                noticia={n}
                variant="list"
                onClick={() => onNavigate('noticia-detalhe', { noticiaId: n.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
