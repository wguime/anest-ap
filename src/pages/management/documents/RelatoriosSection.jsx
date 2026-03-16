import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Plus,
  Search,
  Archive,
  BarChart3,
  FolderOpen,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Shield
} from 'lucide-react'
import { Card, CardContent, Badge, Button } from '@/design-system'
import { FilterBar, DocumentCard, StatsCard } from '../components'
import { cn } from '@/design-system/utils/tokens'

/**
 * Document type configurations for Relatorios
 */
const DOC_TYPES = {
  mensal: { label: 'Relatorio Mensal', color: '#00838F', icon: FileText },
  trimestral: { label: 'Relatorio Trimestral', color: '#006837', icon: FileText },
  anual: { label: 'Relatorio Anual', color: '#1565C0', icon: FileText },
  incidente: { label: 'Relatorio de Incidente', color: '#D32F2F', icon: AlertTriangle },
  seguranca: { label: 'Relatorio de Seguranca', color: '#7B1FA2', icon: Shield }
}

/**
 * Category configurations for Relatorios
 */
const CATEGORIES = [
  { id: 'seguranca-paciente', label: 'Seguranca do Paciente', icon: Shield, count: 0 },
  { id: 'indicadores', label: 'Indicadores de Qualidade', icon: TrendingUp, count: 0 },
  { id: 'incidentes', label: 'Incidentes e Eventos', icon: AlertTriangle, count: 0 },
  { id: 'gerencial', label: 'Relatorios Gerenciais', icon: BarChart3, count: 0 }
]

/**
 * Filter options for document type
 */
const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'mensal', label: 'Relatorio Mensal' },
  { value: 'trimestral', label: 'Relatorio Trimestral' },
  { value: 'anual', label: 'Relatorio Anual' },
  { value: 'incidente', label: 'Relatorio de Incidente' },
  { value: 'seguranca', label: 'Relatorio de Seguranca' }
]

/**
 * RelatoriosSection - Relatorios documents section
 *
 * @param {string} activeSubTab - Current active sub-tab (documentos, categorias, arquivados, stats)
 * @param {Array} docs - Array of document objects
 * @param {function} onDocAction - Callback for document actions (view, edit, archive)
 * @param {function} onNavigate - Navigation callback
 */
function RelatoriosSection({ activeSubTab = 'documentos', docs = [], onDocAction, onNavigate, onCategoryClick, activeCategoryFilter }) {
  const [searchValue, setSearchValue] = useState('')
  const [filterValues, setFilterValues] = useState({ type: 'all' })
  const [viewMode, setViewMode] = useState('card')

  // Filter documents based on search and filters
  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      // Search filter
      if (searchValue) {
        const search = searchValue.toLowerCase()
        const matchesSearch =
          doc.titulo?.toLowerCase().includes(search) ||
          doc.codigo?.toLowerCase().includes(search) ||
          doc.descricao?.toLowerCase().includes(search)
        if (!matchesSearch) return false
      }

      // Type filter
      if (filterValues.type && filterValues.type !== 'all') {
        if (doc.tipo?.toLowerCase() !== filterValues.type) return false
      }

      // Filter archived based on sub-tab
      if (activeSubTab === 'arquivados') {
        return doc.status?.toLowerCase() === 'arquivado'
      } else if (activeSubTab === 'documentos') {
        return doc.status?.toLowerCase() !== 'arquivado'
      }

      return true
    })
  }, [docs, searchValue, filterValues, activeSubTab])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = docs.filter(d => d.status?.toLowerCase() !== 'arquivado').length
    const archived = docs.filter(d => d.status?.toLowerCase() === 'arquivado').length
    const pending = docs.filter(d => d.status?.toLowerCase() === 'pendente').length
    const incidentes = docs.filter(d => d.tipo?.toLowerCase() === 'incidente').length
    const thisMonth = docs.filter(d => {
      const date = new Date(d.createdAt)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    return { total, archived, pending, incidentes, thisMonth }
  }, [docs])

  // Calculate category counts
  const categoriesWithCounts = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      count: docs.filter(d =>
        d.categoria?.toLowerCase() === cat.id &&
        d.status?.toLowerCase() !== 'arquivado'
      ).length
    }))
  }, [docs])

  useEffect(() => {
    if (activeCategoryFilter) {
      setFilterValues(prev => ({ ...prev, type: activeCategoryFilter }))
    }
  }, [activeCategoryFilter])

  const handleFilterChange = (filterId, value) => {
    setFilterValues(prev => ({ ...prev, [filterId]: value }))
  }

  const handleDocView = (doc) => {
    onDocAction?.('view', doc)
  }

  const handleDocEdit = (doc) => {
    onDocAction?.('edit', doc)
  }

  const handleDocArchive = (doc) => {
    onDocAction?.('archive', doc)
  }

  const handleAddDocument = () => {
    onDocAction?.('add', { section: 'relatorios' })
  }

  // Render document list
  const renderDocumentList = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar relatorios..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[
          { id: 'type', label: 'Tipo', options: TYPE_FILTER_OPTIONS }
        ]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        actionButton={{
          label: 'Novo Relatorio',
          icon: Plus,
          onClick: handleAddDocument
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum relatorio encontrado"
          description={searchValue
            ? "Tente ajustar os filtros ou termo de busca"
            : "Comece adicionando um novo relatorio"
          }
          actionLabel="Adicionar Relatorio"
          onAction={handleAddDocument}
        />
      ) : (
        <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {filteredDocs.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              variant={viewMode}
              config={DOC_TYPES[doc.tipo?.toLowerCase()] || { color: '#00838F', icon: FileText }}
              onView={handleDocView}
              onEdit={handleDocEdit}
              onArchive={handleDocArchive}
            />
          ))}
        </div>
      )}
    </div>
  )

  // Render categories grid
  const renderCategories = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Categorias de Relatorios
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categoriesWithCounts.map(category => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => onCategoryClick?.('relatorios', category.id)}
          />
        ))}
      </div>
    </div>
  )

  // Render archived documents
  const renderArchived = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar relatorios arquivados..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[
          { id: 'type', label: 'Tipo', options: TYPE_FILTER_OPTIONS }
        ]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nenhum relatorio arquivado"
          description="Relatorios arquivados aparecerao aqui"
        />
      ) : (
        <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {filteredDocs.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              variant={viewMode}
              config={DOC_TYPES[doc.tipo?.toLowerCase()] || { color: '#6B7280', icon: Archive }}
              onView={handleDocView}
              onEdit={handleDocEdit}
            />
          ))}
        </div>
      )}
    </div>
  )

  // Render statistics dashboard
  const renderStats = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          value={stats.total}
          label="Total de Relatorios"
          icon={FileText}
          color="#00838F"
        />
        <StatsCard
          value={stats.thisMonth}
          label="Gerados este mes"
          icon={Calendar}
          color="#006837"
          trend={stats.thisMonth > 0 ? { value: `+${stats.thisMonth}`, positive: true } : undefined}
        />
        <StatsCard
          value={stats.incidentes}
          label="Relatorios de Incidentes"
          icon={AlertTriangle}
          color="#D32F2F"
        />
        <StatsCard
          value={stats.archived}
          label="Arquivados"
          icon={Archive}
          color="#6B7280"
        />
      </div>

      <Card className="bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-2xl">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Relatorios por Categoria
          </h3>
          <div className="space-y-3">
            {categoriesWithCounts.map(category => (
              <div key={category.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00838F]/10">
                    <category.icon className="w-4 h-4 text-[#00838F] dark:text-[#4DD0E1]" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {category.label}
                  </span>
                </div>
                <Badge variant="secondary">{category.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-2xl">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Relatorios por Tipo
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {Object.entries(DOC_TYPES).map(([key, config]) => {
              const count = docs.filter(d =>
                d.tipo?.toLowerCase() === key &&
                d.status?.toLowerCase() !== 'arquivado'
              ).length
              return (
                <div key={key} className="text-center p-3 rounded-xl bg-gray-50 dark:bg-[#0D1512]">
                  <div
                    className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${config.color}15`, color: config.color }}
                  >
                    <config.icon className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0]">{config.label}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Render content based on active sub-tab
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
      {renderContent()}
    </motion.div>
  )
}

/**
 * EmptyState - Empty state component
 */
function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <Card className="bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-[#00838F] dark:text-[#4DD0E1]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0] max-w-sm mb-4">
          {description}
        </p>
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            className={cn(
              'flex items-center gap-2',
              'bg-[#006837] hover:bg-[#005730] text-white',
              'rounded-xl px-4 py-2.5'
            )}
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * CategoryCard - Category card component
 */
function CategoryCard({ category, onClick }) {
  const Icon = category.icon

  return (
    <Card
      className={cn(
        'bg-white dark:bg-[#1A2420]',
        'border border-[#C8E6C9] dark:border-[#2A3F36]',
        'rounded-2xl shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-[#2ECC71] transition-all duration-200',
        'group'
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[#00838F]/10 group-hover:bg-[#00838F]/20 transition-colors">
            <Icon className="w-6 h-6 text-[#00838F] dark:text-[#4DD0E1]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-[#00838F] dark:group-hover:text-[#4DD0E1] transition-colors">
              {category.label}
            </h4>
            <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0] mt-0.5">
              {category.count} {category.count === 1 ? 'relatorio' : 'relatorios'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default RelatoriosSection
