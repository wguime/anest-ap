// BibliotecaPage — refactor W2-1
// Accordion DS + filtros multi-faceta + URL state (hash) + localStorage
// Loading/empty/error states · touch targets 44px+ · WCAG AA

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, Skeleton, EmptyState, Button, Badge, SearchBar, SearchToggleButton, Collapsible, CollapsibleContent } from '@/design-system';
import { DocumentoCard, PageHeader } from '@/components';
import { BookOpen, FileText, AlertCircle, Plus, FilePlus2, Landmark, Building2, Stethoscope, Users, GraduationCap, DollarSign, BadgeCheck, Cpu, FileBarChart, Archive, RotateCw } from 'lucide-react';
import { useDocumentsContext } from '@/contexts/DocumentsContext';
import { useUser } from '@/contexts/UserContext';
import { isRevisaoVencida, diasAteRevisao, DOCUMENT_STATUS, CATEGORY_SUBSECTIONS, SUBCATEGORIA_CONFIG } from '@/types/documents';
import { cn } from '@/design-system/utils/tokens';
import { isAdministrator } from '@/design-system/components/anest/admin-only';
import NewDocumentModal from './management/components/NewDocumentModal';
import { FilterBar } from './biblioteca/FilterBar';

// =============================================================================
// CATEGORIA CONFIG — Wave 4 W4-1: deriva do SSOT SUBCATEGORIA_CONFIG
// =============================================================================

const ICON_MAP = {
  FilePlus2, Landmark, Building2, Stethoscope, Users, GraduationCap,
  DollarSign, BadgeCheck, Cpu, FileBarChart, Archive,
};

// Subcategorias conhecidas (vocabulário da Biblioteca). Docs ativos com
// subcategoria fora desta lista (ou nula) caem na seção catch-all "outros"
// em vez de sumirem silenciosamente — garante paridade com o Centro de Gestão.
const KNOWN_SUBCATS = new Set(Object.keys(SUBCATEGORIA_CONFIG));

const CATEGORIA_CONFIG = {
  ...Object.fromEntries(
    Object.entries(SUBCATEGORIA_CONFIG).map(([slug, cfg]) => [
      slug,
      { label: cfg.label, icon: ICON_MAP[cfg.iconKey], order: cfg.order },
    ])
  ),
  outros: { label: '99 Outros (sem subcategoria)', icon: ICON_MAP.Archive, order: 99 },
};

// =============================================================================
// URL state — hash-based + localStorage
// =============================================================================

const STATE_KEY = 'anest:biblioteca:state';

function readUrlState() {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash || '';
    const idx = hash.indexOf('?');
    const qs = idx >= 0 ? hash.slice(idx + 1) : '';
    const params = new URLSearchParams(qs);
    if (![...params.keys()].length) return null;
    return {
      q: params.get('q') || '',
      tipo: (params.get('tipo') || '').split(',').filter(Boolean),
      status: (params.get('status') || '').split(',').filter(Boolean),
      vencimento: (params.get('vencimento') || '').split(',').filter(Boolean),
      tagsSel: (params.get('tags') || '').split(',').filter(Boolean),
      open: (params.get('open') || '').split(',').filter(Boolean),
    };
  } catch {
    return null;
  }
}

function readLocalState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      q: parsed.q || '',
      tipo: Array.isArray(parsed.tipo) ? parsed.tipo : [],
      status: Array.isArray(parsed.status) ? parsed.status : [],
      vencimento: Array.isArray(parsed.vencimento) ? parsed.vencimento : [],
      tagsSel: Array.isArray(parsed.tagsSel) ? parsed.tagsSel : [],
      open: Array.isArray(parsed.open) ? parsed.open : [],
    };
  } catch {
    return null;
  }
}

function writeState({ q, tipo, status, vencimento, tagsSel, open }) {
  if (typeof window === 'undefined') return;
  // localStorage
  try {
    window.localStorage?.setItem(
      STATE_KEY,
      JSON.stringify({ q, tipo, status, vencimento, tagsSel, open })
    );
  } catch {
    /* noop */
  }
  // hash URL state
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tipo.length) params.set('tipo', tipo.join(','));
    if (status.length) params.set('status', status.join(','));
    if (vencimento.length) params.set('vencimento', vencimento.join(','));
    if (tagsSel.length) params.set('tags', tagsSel.join(','));
    if (open.length) params.set('open', open.join(','));

    const base = '#/biblioteca';
    const qs = params.toString();
    const next = qs ? `${base}?${qs}` : base;
    if (window.location.hash !== next) {
      // replaceState para não poluir histórico a cada keystroke
      window.history.replaceState(null, '', next);
    }
  } catch {
    /* noop */
  }
}

// =============================================================================
// Vencimento helpers
// =============================================================================

// Formata slug "anestesia-regional" → "Anestesia Regional".
// (Server-side label vem da tabela `tags`, mas para evitar round-trip no
// filtro do consumidor caímos pra slug humanizado no FilterBar.)
function formatTagLabel(slug) {
  if (!slug) return '';
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function vencimentoBucket(doc) {
  if (!doc.proximaRevisao) return 'sem_revisao';
  if (isRevisaoVencida(doc.proximaRevisao)) return 'vencidos';
  const dias = diasAteRevisao(doc.proximaRevisao);
  if (typeof dias === 'number' && dias <= 30) return 'proximos';
  return 'em_dia';
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BibliotecaPage({ onNavigate }) {
  useEffect(() => {
    document.title = 'Biblioteca — ANEST';
  }, []);

  // Restaurar estado: URL > localStorage > default
  const initial = useMemo(() => readUrlState() || readLocalState() || {}, []);

  const [searchTerm, setSearchTerm] = useState(initial.q || '');
  const [tipoFilter, setTipoFilter] = useState(initial.tipo || []);
  const [statusFilter, setStatusFilter] = useState(initial.status || []);
  const [vencimentoFilter, setVencimentoFilter] = useState(initial.vencimento || []);
  const [tagsFilter, setTagsFilter] = useState(initial.tagsSel || []);
  // Sempre inicia com accordions fechados (não restaura `open` persistido —
  // o auto-open por busca/filtro poluía o localStorage e a Biblioteca abria
  // com várias categorias expandidas). O state ainda é persistido na sessão.
  const [openSections, setOpenSections] = useState([]);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(initial.q));
  const searchPanelId = 'biblioteca-search-panel';
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchTerm('');
  }, []);

  const { user } = useUser();
  const isAdmin = isAdministrator(user);

  const {
    documents,
    isLoading,
    isInitialized,
    error: contextError,
  } = useDocumentsContext();

  // Persistir estado em URL + localStorage
  useEffect(() => {
    writeState({
      q: searchTerm,
      tipo: tipoFilter,
      status: statusFilter,
      vencimento: vencimentoFilter,
      tagsSel: tagsFilter,
      open: openSections,
    });
  }, [searchTerm, tipoFilter, statusFilter, vencimentoFilter, tagsFilter, openSections]);

  // Refetch local — atualiza o estado para forçar re-render do contexto
  // (DocumentsContext não expõe refetch, usamos reload de página como fallback seguro)
  const handleRetry = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  // Pool de documentos
  const allDocs = useMemo(
    () =>
      Object.values(documents)
        .flat()
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR')),
    [documents]
  );

  const allActiveDocs = useMemo(
    () => allDocs.filter((d) => d.status !== 'arquivado'),
    [allDocs]
  );
  const allArchivedDocs = useMemo(
    () => allDocs.filter((d) => d.status === 'arquivado' && d.subcategoria === 'obsoletos'),
    [allDocs]
  );

  // Aplicar filtros multi-faceta a um doc
  const matchesFacets = useCallback(
    (doc) => {
      if (tipoFilter.length && !tipoFilter.includes(doc.tipo)) return false;
      if (statusFilter.length && !statusFilter.includes(doc.status)) return false;
      if (vencimentoFilter.length) {
        const bucket = vencimentoBucket(doc);
        if (!vencimentoFilter.includes(bucket)) return false;
      }
      if (tagsFilter.length) {
        const docTags = Array.isArray(doc.tags) ? doc.tags : [];
        // AND: doc precisa conter todas as tags selecionadas
        if (!tagsFilter.every((t) => docTags.includes(t))) return false;
      }
      return true;
    },
    [tipoFilter, statusFilter, vencimentoFilter, tagsFilter]
  );

  // Tags disponíveis = distinct sobre o pool ativo. Slug + label legível.
  const availableTags = useMemo(() => {
    const counts = new Map();
    for (const doc of allActiveDocs) {
      if (!Array.isArray(doc.tags)) continue;
      for (const slug of doc.tags) {
        if (typeof slug !== 'string' || !slug) continue;
        counts.set(slug, (counts.get(slug) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([slug, count]) => ({
        value: slug,
        label: `${formatTagLabel(slug)} (${count})`,
      }));
  }, [allActiveDocs]);

  // Aplicar busca textual a um doc
  const term = searchTerm.trim().toLowerCase();
  const matchesSearch = useCallback(
    (doc) => {
      if (!term) return true;
      return (
        doc.titulo?.toLowerCase().includes(term) ||
        doc.codigo?.toLowerCase().includes(term) ||
        doc.tags?.some((t) => t.toLowerCase().includes(term))
      );
    },
    [term]
  );

  // Agrupar documentos por categoria, já filtrados
  const documentosPorCategoria = useMemo(() => {
    const sorted = Object.entries(CATEGORIA_CONFIG).sort(
      ([, a], [, b]) => a.order - b.order
    );

    return sorted.map(([categoria, config]) => {
      const pool = categoria === 'obsoletos' ? allArchivedDocs : allActiveDocs;
      let inCategoria;
      if (categoria === 'obsoletos') {
        inCategoria = pool;
      } else if (categoria === 'outros') {
        // catch-all: ativos cuja subcategoria não casa com nenhuma conhecida (ou é nula)
        inCategoria = pool.filter((d) => !KNOWN_SUBCATS.has(d.subcategoria));
      } else {
        inCategoria = pool.filter((d) => d.subcategoria === categoria);
      }

      const categoryMatchesSearch =
        !term || config.label.toLowerCase().includes(term);

      const docs = inCategoria.filter((d) => {
        if (!matchesFacets(d)) return false;
        if (categoryMatchesSearch) return true;
        // categoria não bate na busca — exigir que doc bata
        return matchesSearch(d);
      });

      return {
        categoria,
        config,
        documentos: docs,
        order: config.order,
      };
    });
  }, [allActiveDocs, allArchivedDocs, term, matchesFacets, matchesSearch]);

  const hasFacetFilters =
    tipoFilter.length > 0 ||
    statusFilter.length > 0 ||
    vencimentoFilter.length > 0 ||
    tagsFilter.length > 0;

  const hasActiveFilters = Boolean(term) || hasFacetFilters;

  const visibleCategories = useMemo(
    () =>
      (hasActiveFilters
        ? documentosPorCategoria.filter((s) => s.documentos.length > 0)
        : documentosPorCategoria
      // "outros" só aparece quando tem docs (caso contrário não polui a árvore)
      ).filter((s) => s.categoria !== 'outros' || s.documentos.length > 0),
    [documentosPorCategoria, hasActiveFilters]
  );

  // Busca textual → resultados achatados num grid único (sem explodir a árvore
  // de accordions). Filtros de faceta continuam navegando pela árvore.
  const flatResults = useMemo(
    () => (term ? visibleCategories.flatMap((c) => c.documentos) : []),
    [term, visibleCategories]
  );

  // Auto-abrir categorias só em filtros de faceta (busca textual usa a lista
  // achatada e não mexe na árvore). React 19 derive-during-render no lugar de
  // setState-em-effect: atualiza openSections quando o conjunto de categorias
  // visíveis muda com facetas ativas.
  const facetKey = hasFacetFilters ? visibleCategories.map((c) => c.categoria).join('|') : null;
  const [prevFacetKey, setPrevFacetKey] = useState(facetKey);
  if (facetKey !== prevFacetKey) {
    setPrevFacetKey(facetKey);
    if (facetKey !== null) {
      setOpenSections(visibleCategories.map((c) => c.categoria));
    }
  }

  // Totais e badges
  const _totalDocs = allActiveDocs.length;
  const _overdueCount = useMemo(
    () =>
      Object.values(documents)
        .flat()
        .filter(
          (doc) =>
            doc.status === DOCUMENT_STATUS.ATIVO &&
            isRevisaoVencida(doc.proximaRevisao)
        ).length,
    [documents]
  );
  const _pendingCount = useMemo(
    () =>
      Object.values(documents)
        .flat()
        .filter((doc) => doc.status === DOCUMENT_STATUS.PENDENTE).length,
    [documents]
  );

  const handleDocumentoClick = (documento) => {
    onNavigate('documento-detalhe', {
      documentoId: documento.id,
      returnTo: 'biblioteca',
    });
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setTipoFilter([]);
    setStatusFilter([]);
    setVencimentoFilter([]);
    setTagsFilter([]);
  };

  // ==========================================================================
  // Main render
  // ==========================================================================
  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Biblioteca"
        onBack={() => onNavigate('gestao')}
        actions={
          <div className="flex items-center gap-2">
            <SearchToggleButton
              size="sm"
              active={searchOpen}
              onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
              controlsId={searchPanelId}
            />
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowNewDocModal(true)}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 sm:px-5 pt-4">
        {/* SearchBar via Collapsible — toggle pelo lupa no header (estilo Home) */}
        <Collapsible open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeSearch()}>
          <CollapsibleContent>
            <div id={searchPanelId} className="mb-3">
              <SearchBar
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar documentos..."
                aria-label="Buscar documentos"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Barra de filtros (sem search — search agora vive no header) */}
        <FilterBar
          tipo={tipoFilter}
          onTipoChange={setTipoFilter}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          vencimento={vencimentoFilter}
          onVencimentoChange={setVencimentoFilter}
          tags={tagsFilter}
          onTagsChange={setTagsFilter}
          availableTags={availableTags}
          onClearAll={clearAllFilters}
        />

        {/* Estados: error > loading > empty > content */}
        {contextError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center"
          >
            <AlertCircle
              className="w-10 h-10 text-destructive mx-auto mb-3"
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-foreground mb-1">
              Erro ao carregar documentos
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {String(contextError)}
            </p>
            <Button
              variant="default"
              size="default"
              leftIcon={<RotateCw className="w-4 h-4" />}
              onClick={handleRetry}
            >
              Tentar novamente
            </Button>
          </div>
        ) : isLoading && !isInitialized ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Carregando documentos"
            className="space-y-3"
          >
            <span className="sr-only">Carregando documentos…</span>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="custom"
                className="rounded-xl"
                width="100%"
                height="64px"
                borderRadius="12px"
              />
            ))}
          </div>
        ) : visibleCategories.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-full w-full" aria-hidden="true" />}
            title={
              hasActiveFilters
                ? 'Nenhum documento encontrado'
                : 'Nenhum documento ainda'
            }
            description={
              hasActiveFilters
                ? 'Tente ajustar os filtros ou limpar a busca.'
                : isAdmin
                ? 'Comece criando o primeiro documento da biblioteca.'
                : 'Aguarde a publicação de novos documentos.'
            }
            action={
              hasActiveFilters
                ? { label: 'Limpar filtros', onClick: clearAllFilters, variant: 'secondary' }
                : isAdmin
                ? {
                    label: 'Criar primeiro documento',
                    onClick: () => setShowNewDocModal(true),
                  }
                : undefined
            }
          />
        ) : term ? (
          /* Busca textual → resultados achatados (sem explodir accordions) */
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              {flatResults.length} resultado{flatResults.length !== 1 ? 's' : ''} para “{searchTerm.trim()}”
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flatResults.map((doc) => (
                <DocumentoCard
                  key={doc.id}
                  documento={doc}
                  onClick={() => handleDocumentoClick(doc)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-xl border border-border bg-card overflow-hidden'
            )}
          >
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
            >
              {visibleCategories.map(({ categoria, config, documentos }) => {
                const Icon = config.icon;
                return (
                  <AccordionItem key={categoria} value={categoria}>
                    <AccordionTrigger className="px-4 min-h-[56px] py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0"
                          aria-hidden="true"
                        >
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="flex-1 text-left text-[15px] font-semibold text-foreground truncate">
                          {config.label}
                        </span>
                        <span
                          className={cn(
                            'flex items-center justify-center',
                            'min-w-[28px] h-6 px-2 rounded-full',
                            'text-xs font-bold bg-muted text-primary'
                          )}
                          aria-label={`${documentos.length} documento${documentos.length !== 1 ? 's' : ''}`}
                        >
                          {documentos.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2">
                      <SubsectionsView
                        categoria={categoria}
                        documentos={documentos}
                        onDocClick={handleDocumentoClick}
                        forceOpen={hasActiveFilters}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        {/* Footer informativo */}
        <div
          className={cn(
            'mt-6 p-4 rounded-xl bg-muted border border-border'
          )}
        >
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Todos os documentos passam por revisão
            periódica conforme cronograma institucional. Versões anteriores ficam
            disponíveis para consulta histórica.
          </p>
        </div>
      </div>

      {/* Modal — admin escolhe seção da Biblioteca */}
      <NewDocumentModal
        open={showNewDocModal}
        onClose={() => setShowNewDocModal(false)}
      />
    </div>
  );
}

// =============================================================================
// SubsectionsView — sub-accordion dentro de cada categoria
// =============================================================================

export function SubsectionsView({ categoria, documentos, onDocClick, forceOpen }) {
  const subsections = useMemo(() => CATEGORY_SUBSECTIONS[categoria] || [], [categoria]);
  const knownValues = new Set(subsections.map((s) => s.value));
  const ungrouped = documentos.filter((d) => !knownValues.has(d.tipo));
  const [openSubs, setOpenSubs] = useState([]);

  // Auto-abrir tudo quando há filtros/busca; senão controlado pelo state local
  const defaultOpen = useMemo(
    () =>
      forceOpen
        ? [
            ...subsections
              .filter((sub) => documentos.some((d) => d.tipo === sub.value))
              .map((sub) => sub.value),
            ...(ungrouped.length > 0 ? ['__ungrouped__'] : []),
          ]
        : [],
    [forceOpen, subsections, documentos, ungrouped.length]
  );

  if (documentos.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-muted/40">
        <FileText
          className="w-4 h-4 text-muted-foreground shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          Nenhum documento nesta seção.
        </p>
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      value={forceOpen ? defaultOpen : openSubs}
      onValueChange={setOpenSubs}
      key={forceOpen ? `force:${defaultOpen.join('|')}` : 'manual'}
    >
      <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/60">
        {subsections.map((sub) => {
          const subDocs = documentos.filter((d) => d.tipo === sub.value);
          if (subDocs.length === 0) return null;
          return (
            <AccordionItem key={sub.value} value={sub.value} className="bg-card">
              <AccordionTrigger className="px-3 min-h-[44px] py-2">
                <span className="flex-1 text-left text-sm font-medium text-foreground truncate">
                  {sub.label}
                </span>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {subDocs.length}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-0">
                <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 pt-2', !forceOpen && 'ds-stagger-in')}>
                  {subDocs.map((doc) => (
                    <DocumentoCard
                      key={doc.id}
                      documento={doc}
                      onClick={() => onDocClick(doc)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {ungrouped.length > 0 && (
          <AccordionItem value="__ungrouped__" className="bg-card">
            <AccordionTrigger className="px-3 min-h-[44px] py-2">
              <span className="flex-1 text-left text-sm font-medium text-muted-foreground">
                Outros
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {ungrouped.length}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-0">
              <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3 pt-2', !forceOpen && 'ds-stagger-in')}>
                {ungrouped.map((doc) => (
                  <DocumentoCard
                    key={doc.id}
                    documento={doc}
                    onClick={() => onDocClick(doc)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </div>
    </Accordion>
  );
}
