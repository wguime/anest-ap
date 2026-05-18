import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Archive, AlertTriangle, Calendar, RefreshCw, FileText, CheckCircle2, XCircle, Table as TableIcon, Clock } from 'lucide-react'
import { Card, CardContent, Badge } from '@/design-system'
import { FilterBar, DocumentCard, StatsCard } from '../components'
import { EmptyState } from '../components/EmptyState'
import { CategoryCard } from '../components/CategoryCard'
import { buildSectionCategories, buildTypeFilters, getDocCardConfig } from './sectionUtils'
import { SectionLoading } from './SectionLoading'
import { SECTION_CONFIG } from './sectionConfig'
import { SUBCATEGORIA_CONFIG, SUBCATEGORIA_SLUGS, isRevisaoVencida } from '@/types/documents'
import { findOrphanDocs } from '@/utils/documentUtils'
import { cn } from '@/design-system/utils/tokens'

/**
 * DocumentSection — parametrized section component for the Centro de Gestao.
 *
 * Replaces the 9 nearly-identical *Section.jsx files. Driven by SECTION_CONFIG.
 *
 * Supported sub-tabs (driven by config + extraTabs):
 *  - 'documentos'        — main list, search + filter + actions
 *  - 'categorias'        — grid of CategoryCard
 *  - 'arquivados'        — list filtered to status=arquivado
 *  - 'stats'             — stats dashboard
 *  - 'revisoes'          — (extraTab) docs in revision/pending
 *  - 'relatorios'        — (extraTab) consolidated reports
 *
 * @param {string} categoryId - Section identifier (key in SECTION_CONFIG)
 * @param {string} activeSubTab - Current sub-tab
 * @param {Array}  docs - Documents for this section
 * @param {boolean} isLoading - Loading state
 * @param {function} onDocAction - (action, doc) => void
 * @param {function} onNavigate - Navigation callback
 * @param {function} onCategoryClick - Category click handler
 * @param {string} activeCategoryFilter - Pre-selected category filter
 */
function DocumentSection({
  categoryId,
  activeSubTab = 'documentos',
  docs = [],
  isLoading = false,
  onDocAction,
  onNavigate, // eslint-disable-line no-unused-vars
  onCategoryClick,
  activeCategoryFilter,
}) {
  const config = SECTION_CONFIG[categoryId]

  const [searchValue, setSearchValue] = useState('')
  // Track the previous activeCategoryFilter so we only sync into local state
  // when it changes (avoids cascading effects + setState-in-effect lint warn).
  const [prevCategoryFilter, setPrevCategoryFilter] = useState(activeCategoryFilter)
  const [filterValues, setFilterValues] = useState({
    type: activeCategoryFilter || 'all',
    subcategoria: 'all', // W4-3: filtro por subcategoria
  })
  const [viewMode, setViewMode] = useState('card')
  // W4-4: chip de compliance ativo (null | 'vencidos' | 'aguardando' | 'sem_subcat')
  const [complianceChip, setComplianceChip] = useState(null)

  // React 19 idiom: derive-during-render to sync filter when prop changes.
  if (activeCategoryFilter && activeCategoryFilter !== prevCategoryFilter) {
    setPrevCategoryFilter(activeCategoryFilter)
    setFilterValues((prev) => ({ ...prev, type: activeCategoryFilter }))
  }

  const categoriesWithCounts = useMemo(() => buildSectionCategories(docs), [docs])
  const typeFilterOptions = useMemo(() => buildTypeFilters(docs), [docs])

  // W4-3: opções do filtro de subcategoria — derivadas do SSOT
  const subcategoriaFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Todas as subcategorias' },
      ...SUBCATEGORIA_SLUGS.map((slug) => ({
        value: slug,
        label: SUBCATEGORIA_CONFIG[slug].label,
      })),
    ]
  }, [])

  // W4-4: contagens para chips de compliance
  const complianceCounts = useMemo(() => {
    if (!Array.isArray(docs)) return { vencidos: 0, aguardando: 0, semSubcat: 0 }
    const ativos = docs.filter((d) => d.status?.toLowerCase() !== 'arquivado')
    const vencidos = ativos.filter((d) => isRevisaoVencida(d.proximaRevisao)).length
    const aguardando = ativos.filter((d) => {
      const s = d.status?.toLowerCase()
      return s === 'pendente' || s === 'revisao'
    }).length
    const semSubcat = findOrphanDocs(ativos).length
    return { vencidos, aguardando, semSubcat }
  }, [docs])

  // Filter documents based on search, type, subcategoria, compliance chip, and active sub-tab
  const filteredDocs = useMemo(() => {
    if (!Array.isArray(docs)) return []
    return docs.filter((doc) => {
      // Search filter (includes tags only when config.searchByTags is true — biblioteca)
      if (searchValue) {
        const search = searchValue.toLowerCase()
        const matchesText =
          doc.titulo?.toLowerCase().includes(search) ||
          doc.codigo?.toLowerCase().includes(search) ||
          doc.descricao?.toLowerCase().includes(search)
        const matchesTags =
          config?.searchByTags && doc.tags?.some((tag) => tag.toLowerCase().includes(search))
        if (!matchesText && !matchesTags) return false
      }

      // Type filter
      if (filterValues.type && filterValues.type !== 'all') {
        if (doc.tipo?.toLowerCase() !== filterValues.type) return false
      }

      // W4-3: Subcategoria filter
      if (filterValues.subcategoria && filterValues.subcategoria !== 'all') {
        if (doc.subcategoria?.toLowerCase() !== filterValues.subcategoria) return false
      }

      // W4-4: Compliance chip filter
      if (complianceChip === 'vencidos' && !isRevisaoVencida(doc.proximaRevisao)) return false
      if (complianceChip === 'aguardando') {
        const s = doc.status?.toLowerCase()
        if (s !== 'pendente' && s !== 'revisao') return false
      }
      if (complianceChip === 'sem_subcat') {
        const sub = doc.subcategoria?.toLowerCase()
        if (sub && SUBCATEGORIA_SLUGS.includes(sub)) return false
      }

      // Sub-tab filter
      const status = doc.status?.toLowerCase()
      const tipo = doc.tipo?.toLowerCase()

      if (activeSubTab === 'arquivados') return status === 'arquivado'
      if (activeSubTab === 'revisoes') return status === 'revisao' || status === 'pendente'
      if (activeSubTab === 'relatorios') return tipo === 'relatorio' || tipo === 'consolidado'
      if (activeSubTab === 'documentos') return status !== 'arquivado'

      return true
    })
  }, [docs, searchValue, filterValues, complianceChip, activeSubTab, config])

  // Statistics — auditoria-specific extras computed only when needed
  const stats = useMemo(() => {
    const list = Array.isArray(docs) ? docs : []
    const total = list.filter((d) => d.status?.toLowerCase() !== 'arquivado').length
    const archived = list.filter((d) => d.status?.toLowerCase() === 'arquivado').length
    const pending = list.filter((d) => {
      const s = d.status?.toLowerCase()
      return s === 'pendente' || s === 'revisao'
    }).length
    const conformidades = list.filter((d) => d.tipo?.toLowerCase() === 'conformidade').length
    const naoConformidades = list.filter((d) => d.tipo?.toLowerCase() === 'naoconformidade').length
    const incidentes = list.filter((d) => d.tipo?.toLowerCase() === 'incidente').length
    const thisMonth = list.filter((d) => {
      const date = new Date(d.createdAt)
      if (Number.isNaN(date.getTime())) return false
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    return { total, archived, pending, conformidades, naoConformidades, incidentes, thisMonth }
  }, [docs])

  if (!config) {
    // Defensive: unknown categoryId — render nothing (parent should handle)
    return null
  }

  const handleFilterChange = (filterId, value) => {
    setFilterValues((prev) => ({ ...prev, [filterId]: value }))
  }
  const handleDocView = (doc) => onDocAction?.('view', doc)
  const handleDocEdit = (doc) => onDocAction?.('edit', doc)
  const handleDocArchive = (doc) => onDocAction?.('archive', doc)
  const handleAddDocument = () => onDocAction?.('add', { section: categoryId })

  const Icon = config.icon

  // W4-5: View tabular densa — alternativa a card/list
  const renderDocTable = (list) => (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-foreground">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Título</th>
            <th className="px-3 py-2 font-medium">Código</th>
            <th className="px-3 py-2 font-medium">Subcategoria</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Próxima Revisão</th>
            <th className="px-3 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {list.map((doc) => {
            const subLabel = doc.subcategoria
              ? SUBCATEGORIA_CONFIG[doc.subcategoria]?.label ?? doc.subcategoria
              : '—'
            const overdue = isRevisaoVencida(doc.proximaRevisao)
            return (
              <tr
                key={doc.id}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  <button
                    type="button"
                    onClick={() => handleDocView(doc)}
                    className="text-left hover:underline"
                  >
                    {doc.titulo || '—'}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{doc.codigo || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{subLabel}</td>
                <td className="px-3 py-2">
                  <Badge variant={doc.status === 'arquivado' ? 'secondary' : 'default'}>
                    {doc.status || '—'}
                  </Badge>
                </td>
                <td className={cn('px-3 py-2', overdue && 'text-destructive font-medium')}>
                  {doc.proximaRevisao
                    ? new Date(doc.proximaRevisao).toLocaleDateString('pt-BR')
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleDocEdit(doc)}
                    className="text-primary hover:underline text-xs"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // Renders the document grid/list/table
  const renderDocList = (list) => {
    if (viewMode === 'table') return renderDocTable(list)
    return (
      <div
        className={
          viewMode === 'list'
            ? 'flex flex-col gap-2'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
        }
      >
        {list.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            variant={viewMode}
            config={getDocCardConfig(doc.tipo)}
            onView={handleDocView}
            onEdit={handleDocEdit}
            onArchive={activeSubTab === 'arquivados' ? undefined : handleDocArchive}
            isOverdue={activeSubTab === 'revisoes' ? doc.isOverdue : undefined}
          />
        ))}
      </div>
    )
  }

  // W4-4: Chips de compliance acima da lista (toggleable)
  const renderComplianceChips = () => {
    const { vencidos, aguardando, semSubcat } = complianceCounts
    if (vencidos === 0 && aguardando === 0 && semSubcat === 0) return null
    const chip = (id, label, count, icon, tone) => (
      <button
        type="button"
        onClick={() => setComplianceChip(complianceChip === id ? null : id)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors min-h-[36px]',
          complianceChip === id
            ? `${tone.activeBg} ${tone.activeText} ${tone.activeBorder}`
            : `bg-card text-muted-foreground border-border hover:${tone.hoverBg}`
        )}
        aria-pressed={complianceChip === id}
      >
        {icon}
        <span>{label}</span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            complianceChip === id ? 'bg-white/30' : tone.badgeBg
          )}
        >
          {count}
        </span>
      </button>
    )
    return (
      <div className="flex flex-wrap items-center gap-2">
        {vencidos > 0 &&
          chip('vencidos', 'Vencidos', vencidos, <Clock className="w-3.5 h-3.5" />, {
            activeBg: 'bg-destructive',
            activeText: 'text-white',
            activeBorder: 'border-destructive',
            hoverBg: 'bg-destructive/10',
            badgeBg: 'bg-destructive/15 text-destructive',
          })}
        {aguardando > 0 &&
          chip(
            'aguardando',
            'Aguardando aprovação',
            aguardando,
            <RefreshCw className="w-3.5 h-3.5" />,
            {
              activeBg: 'bg-warning',
              activeText: 'text-white',
              activeBorder: 'border-warning',
              hoverBg: 'bg-warning/10',
              badgeBg: 'bg-warning/15 text-warning-foreground',
            }
          )}
        {semSubcat > 0 &&
          chip(
            'sem_subcat',
            'Sem subcategoria',
            semSubcat,
            <AlertTriangle className="w-3.5 h-3.5" />,
            {
              activeBg: 'bg-info',
              activeText: 'text-white',
              activeBorder: 'border-info',
              hoverBg: 'bg-info/10',
              badgeBg: 'bg-info/15 text-info',
            }
          )}
        {complianceChip && (
          <button
            type="button"
            onClick={() => setComplianceChip(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >
            limpar filtro
          </button>
        )}
      </div>
    )
  }

  // ─── Sub-tab renderers ────────────────────────────────────────────────────
  const renderDocumentList = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder={config.searchPlaceholder}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[
          { id: 'type', label: 'Tipo', options: typeFilterOptions },
          { id: 'subcategoria', label: 'Subcategoria', options: subcategoriaFilterOptions },
        ]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        actionButton={{
          label: config.addLabel,
          icon: Plus,
          onClick: handleAddDocument,
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {renderComplianceChips()}

      {/* W4-5: toggle extra para view tabular (FilterBar só tem card/list) */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border min-h-[36px]',
            viewMode === 'table'
              ? 'bg-primary text-white border-primary'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'
          )}
          aria-pressed={viewMode === 'table'}
        >
          <TableIcon className="w-3.5 h-3.5" />
          {viewMode === 'table' ? 'Tabela ativa' : 'Tabela'}
        </button>
      </div>

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={Icon}
          iconColorClass={config.color}
          title={config.emptyTitle}
          description={
            searchValue ? 'Tente ajustar os filtros ou termo de busca' : config.emptyDescription
          }
          actionLabel={config.addEmptyLabel}
          onAction={handleAddDocument}
        />
      ) : (
        renderDocList(filteredDocs)
      )}
    </div>
  )

  const renderCategories = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Categorias de Documentos</h3>
      </div>

      <div className={`grid ${config.categoriesGridCols} gap-4`}>
        {categoriesWithCounts.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            unit={config.unit}
            onClick={() => onCategoryClick?.(categoryId, category.id)}
          />
        ))}
      </div>
    </div>
  )

  const renderArchived = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar documentos arquivados..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[{ id: 'type', label: 'Tipo', options: typeFilterOptions }]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={Archive}
          iconColorClass={config.color}
          title="Nenhum documento arquivado"
          description="Documentos arquivados aparecerao aqui"
        />
      ) : (
        renderDocList(filteredDocs)
      )}
    </div>
  )

  const renderReviews = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar auditorias em revisao..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[{ id: 'type', label: 'Tipo', options: typeFilterOptions }]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          iconColorClass={config.color}
          title="Nenhuma auditoria em revisao"
          description="Auditorias pendentes de revisao aparecerao aqui"
        />
      ) : (
        renderDocList(filteredDocs)
      )}
    </div>
  )

  const renderReports = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar relatorios de auditoria..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        actionButton={{
          label: 'Novo Relatorio',
          icon: Plus,
          onClick: () => onDocAction?.('add', { section: categoryId, type: 'relatorio' }),
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          iconColorClass={config.color}
          title="Nenhum relatorio encontrado"
          description="Relatorios consolidados aparecerao aqui"
          actionLabel="Criar Relatorio"
          onAction={() => onDocAction?.('add', { section: categoryId, type: 'relatorio' })}
        />
      ) : (
        renderDocList(filteredDocs)
      )}
    </div>
  )

  const renderStats = () => {
    // Auditorias-specific stat layout (3+3) when conformidades/nao conformidades exist
    const isAuditorias = categoryId === 'auditorias'
    const isRelatorios = categoryId === 'relatorios'

    return (
      <div className="space-y-6">
        {isAuditorias ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatsCard
                value={stats.total}
                label={config.statsTotalLabel}
                icon={Icon}
                color={config.statColor}
              />
              <StatsCard
                value={stats.conformidades}
                label="Conformidades"
                icon={CheckCircle2}
                color="#006837"
              />
              <StatsCard
                value={stats.naoConformidades}
                label="Nao Conformidades"
                icon={XCircle}
                color="#D32F2F"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatsCard
                value={stats.thisMonth}
                label="Realizadas este mes"
                icon={Calendar}
                color="#1565C0"
                trend={stats.thisMonth > 0 ? { value: `+${stats.thisMonth}`, positive: true } : undefined}
              />
              <StatsCard
                value={stats.pending}
                label="Pendentes de Revisao"
                icon={AlertTriangle}
                color="#EF6C00"
              />
              <StatsCard
                value={stats.archived}
                label="Arquivadas"
                icon={Archive}
                color="#6B7280"
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              value={stats.total}
              label={config.statsTotalLabel}
              icon={Icon}
              color={config.statColor}
            />
            <StatsCard
              value={stats.thisMonth}
              label={isRelatorios ? 'Gerados este mes' : 'Adicionados este mes'}
              icon={isRelatorios ? Calendar : Plus}
              color={isRelatorios ? '#006837' : '#1565C0'}
              trend={stats.thisMonth > 0 ? { value: `+${stats.thisMonth}`, positive: true } : undefined}
            />
            {isRelatorios ? (
              <StatsCard
                value={stats.incidentes}
                label="Relatorios de Incidentes"
                icon={AlertTriangle}
                color="#D32F2F"
              />
            ) : (
              <StatsCard
                value={stats.pending}
                label="Pendentes de Revisao"
                icon={AlertTriangle}
                color="#EF6C00"
              />
            )}
            <StatsCard
              value={stats.archived}
              label="Arquivados"
              icon={Archive}
              color="#6B7280"
            />
          </div>
        )}

        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {config.statsCategoryTitle}
            </h3>
            <div className="space-y-3">
              {categoriesWithCounts.map((category) => {
                const CatIcon = category.icon
                return (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {CatIcon ? <CatIcon className="w-4 h-4 text-primary" /> : null}
                      </div>
                      <span className="text-sm font-medium text-foreground">{category.label}</span>
                    </div>
                    <Badge variant="secondary">{category.count}</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Sub-tab dispatcher ───────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeSubTab) {
      case 'documentos':
        return renderDocumentList()
      case 'categorias':
        return renderCategories()
      case 'arquivados':
        return renderArchived()
      case 'stats':
        return renderStats()
      case 'revisoes':
        if (config.extraTabs?.includes('revisoes')) return renderReviews()
        return renderDocumentList()
      case 'relatorios':
        if (config.extraTabs?.includes('relatorios')) return renderReports()
        return renderDocumentList()
      default:
        return renderDocumentList()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {isLoading ? <SectionLoading /> : renderContent()}
    </motion.div>
  )
}

export default DocumentSection
