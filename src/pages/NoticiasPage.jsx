/**
 * NoticiasPage — Central de Notícias.
 *
 * Estrutura:
 *  1. Header (createPortal): < Voltar | "Central de Notícias" | LayoutGrid (modal)
 *  2. SearchBar (DS anest)
 *  3. Tabs DS: Todas + 4 revistas, scroll horizontal em mobile
 *  4. Hero: top 10 da tab via HScroll (label "Em destaque" + Sparkles)
 *  5. Lista de 20 por vez, paginada com botão "Carregar mais"
 *
 * CRITICAL — sem AnimatePresence na lista (causa jank).
 *           — sem <Carousel> DS (causa scroll travado).
 *           — useDeferredValue para diferir o filtro pesado da busca.
 */
import { useEffect, useMemo, useState, useDeferredValue, useId } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, LayoutGrid, Newspaper, Sparkles } from 'lucide-react'
import { useNoticias } from '@/contexts/NoticiasContext'
import { useUptodate } from '@/contexts/UptodateContext'
import { NoticiaCard } from '@/components/noticias/NoticiaCard'
import { HScroll } from '@/components/noticias/HScroll'
import { CategoriasGrid } from '@/components/noticias/CategoriasGrid'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  EmptyState,
  Skeleton,
  Modal,
  Button,
  SearchToggleButton,
  Collapsible,
  CollapsibleContent,
  UptodateCard,
} from '@/design-system'
import { SearchBar } from '@/design-system/components/anest/search-bar'

const TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'Anesthesiology', label: 'Anesthesiology' },
  { value: 'BJA', label: 'BJA' },
  { value: 'Anaesthesia', label: 'Anaesthesia' },
  { value: 'BJAN', label: 'BJAN' },
]

const PAGE_SIZE = 20

export default function NoticiasPage({ onNavigate, goBack }) {
  const { noticias, loading, noticiasLoaded, loadNoticias } = useNoticias()
  const { topics: utdTopics, featured: utdFeatured, loadFeatured: loadUtdFeatured, loadTopics: loadUtdTopics } = useUptodate()
  const [activeTab, setActiveTab] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const search = useDeferredValue(searchInput)
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE)
  const [categoriasOpen, setCategoriasOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchPanelId = useId()

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchInput('')
  }

  useEffect(() => {
    if (!searchOpen) return
    const t = setTimeout(() => {
      const el = document.querySelector('[data-slot="anest-search-bar-input"]')
      el?.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeSearch() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  useEffect(() => {
    window.scrollTo(0, 0)
    loadNoticias()
    loadUtdFeatured()
    loadUtdTopics()
  }, [loadNoticias, loadUtdFeatured, loadUtdTopics])

  // Top 3 títulos UpToDate para preview no card
  const utdTop3 = useMemo(() => {
    const src = utdFeatured.length > 0 ? utdFeatured : utdTopics
    return src.slice(0, 3).map((t) => t.titulo).filter(Boolean)
  }, [utdFeatured, utdTopics])

  // Filtro por tab + busca
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return noticias.filter((n) => {
      if (activeTab !== 'all' && n.fonte !== activeTab) return false
      if (q) {
        const blob = `${n.tituloPt || ''} ${n.titulo || ''} ${n.resumoPt || ''} ${n.resumo || ''} ${n.autores || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [noticias, activeTab, search])

  // Hero: top 10 do filtrado por finalScore
  const top10 = useMemo(() => {
    return [...filtered]
      .sort((a, b) => {
        const sa = a.finalScore ?? 0
        const sb = b.finalScore ?? 0
        if (sb !== sa) return sb - sa
        return (b.publicadoEm || '').localeCompare(a.publicadoEm || '')
      })
      .slice(0, 10)
  }, [filtered])

  // Lista: ordenação por data, paginada
  const listSorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      (b.publicadoEm || '').localeCompare(a.publicadoEm || ''),
    )
  }, [filtered])

  // Reset paginação ao mudar tab/busca
  useEffect(() => {
    setPageLimit(PAGE_SIZE)
  }, [activeTab, search])

  const visible = listSorted.slice(0, pageLimit)
  const canLoadMore = pageLimit < listSorted.length

  const handleSelectCategoria = (category) => {
    setCategoriasOpen(false)
    onNavigate?.('categoria-noticias', { category })
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
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Publicações
          </h1>
          <div className="min-w-[70px] flex items-center gap-2 justify-end">
            <SearchToggleButton
              size="sm"
              active={searchOpen}
              onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
              controlsId={searchPanelId}
            />
            <button
              type="button"
              onClick={() => setCategoriasOpen(true)}
              aria-label="Abrir categorias"
              className="text-primary hover:opacity-70 transition-opacity"
            >
              <LayoutGrid className="w-5 h-5" />
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

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 pt-4 max-w-3xl mx-auto">
        {/* Search (toggle via lupa no header) */}
        <Collapsible open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeSearch()}>
          <CollapsibleContent>
            <div id={searchPanelId}>
              <SearchBar
                placeholder="Buscar título, resumo ou autor..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="mb-3"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Tabs revistas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="w-full overflow-x-auto justify-start gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="shrink-0">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Loading skeleton */}
        {loading && !noticiasLoaded ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title={search ? 'Nenhum resultado para sua busca' : 'Nenhuma publicação disponível'}
            description={
              search
                ? 'Tente termos diferentes ou limpe a busca.'
                : 'As publicações são atualizadas continuamente. Volte mais tarde.'
            }
          />
        ) : (
          <>
            {/* Hero featured */}
            {top10.length > 0 && (
              <section className="mb-5" aria-label="Em destaque">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                  <h2 className="text-[14px] font-semibold text-foreground">Em destaque</h2>
                </div>
                <HScroll ariaLabel="Destaques desta categoria" showDots loop>
                  {top10.map((n) => (
                    <NoticiaCard
                      key={n.id}
                      noticia={n}
                      variant="carousel"
                      onClick={() => onNavigate?.('noticia-detalhe', { noticiaId: n.id })}
                    />
                  ))}
                </HScroll>
              </section>
            )}

            {/* Card UpToDate (entre hero e mais publicações) */}
            <section className="mb-5" aria-label="UpToDate">
              <UptodateCard
                label="ATUALIZAÇÕES"
                title="UpToDate"
                badgeText={utdTopics.length > 0 ? `${utdTopics.length} tópicos` : 'Em breve'}
                items={utdTop3.length > 0 ? utdTop3 : ['Aguardando primeira coleta semanal']}
                onViewAll={() => onNavigate?.('uptodate')}
              />
            </section>

            {/* Lista paginada */}
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Mais publicações
            </h3>
            <div className="flex flex-col gap-3">
              {visible.map((n) => (
                <NoticiaCard
                  key={n.id}
                  noticia={n}
                  variant="list"
                  onClick={() => onNavigate?.('noticia-detalhe', { noticiaId: n.id })}
                />
              ))}
            </div>

            {canLoadMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPageLimit((p) => p + PAGE_SIZE)}
                >
                  Carregar mais ({listSorted.length - pageLimit} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de categorias */}
      <Modal
        open={categoriasOpen}
        onClose={() => setCategoriasOpen(false)}
        title="Categorias temáticas"
        description="Explore publicações por área de interesse"
      >
        <Modal.Body className="scrollbar-hide">
          <CategoriasGrid noticias={noticias} onSelect={handleSelectCategoria} />
        </Modal.Body>
      </Modal>
    </div>
  )
}
