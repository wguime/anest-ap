import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  FileBarChart,
  FileSearch,
  Receipt,
  ClipboardList,
  Plus,
  Archive,
  AlertTriangle,
  FileText,
  FolderOpen,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, Badge, Button } from '@/design-system'
import { FilterBar, DocumentCard, StatsCard } from '../components'
import { cn } from '@/design-system/utils/tokens'

/**
 * Document type configurations for Financeiro
 */
const DOC_TYPES = {
  orcamento: { label: 'Orcamento', color: '#2E7D32', icon: DollarSign },
  relatorio_financeiro: { label: 'Relatorio Financeiro', color: '#1565C0', icon: FileBarChart },
  contrato: { label: 'Contrato', color: '#7B1FA2', icon: FileText },
  auditoria_fiscal: { label: 'Auditoria Fiscal', color: '#00838F', icon: FileSearch },
  nota_fiscal: { label: 'Nota Fiscal', color: '#EF6C00', icon: Receipt },
  prestacao_contas: { label: 'Prestacao de Contas', color: '#C62828', icon: ClipboardList }
}

/**
 * Category configurations for Financeiro
 */
const CATEGORIES = [
  { id: 'orcamentos', label: 'Orcamentos', icon: DollarSign, count: 0 },
  { id: 'relatorios_financeiros', label: 'Relatorios Financeiros', icon: FileBarChart, count: 0 },
  { id: 'contratos', label: 'Documentos Contratuais', icon: FileText, count: 0 },
  { id: 'auditoria_fiscal', label: 'Auditoria Fiscal', icon: FileSearch, count: 0 },
  { id: 'notas_fiscais', label: 'Notas Fiscais', icon: Receipt, count: 0 },
  { id: 'prestacao_contas', label: 'Prestacao de Contas', icon: ClipboardList, count: 0 }
]

/**
 * Filter options for document type
 */
const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'orcamento', label: 'Orcamento' },
  { value: 'relatorio_financeiro', label: 'Relatorio Financeiro' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'auditoria_fiscal', label: 'Auditoria Fiscal' },
  { value: 'nota_fiscal', label: 'Nota Fiscal' },
  { value: 'prestacao_contas', label: 'Prestacao de Contas' }
]

/**
 * FinanceiroSection - Financeiro documents section
 *
 * @param {string} activeSubTab - Current active sub-tab (documentos, categorias, arquivados, stats)
 * @param {Array} docs - Array of document objects from DocumentsContext
 * @param {function} onDocAction - Callback for document actions (view, edit, archive)
 * @param {function} onNavigate - Navigation callback
 */
function FinanceiroSection({ activeSubTab = 'documentos', docs = [], onDocAction, onNavigate, onCategoryClick, activeCategoryFilter }) {
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
    const thisMonth = docs.filter(d => {
      const date = new Date(d.createdAt)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    return { total, archived, pending, thisMonth }
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
    onDocAction?.('add', { section: 'financeiro' })
  }

  // Render document list
  const renderDocumentList = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar documentos financeiros..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={[
          { id: 'type', label: 'Tipo', options: TYPE_FILTER_OPTIONS }
        ]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        actionButton={{
          label: 'Novo Documento',
          icon: Plus,
          onClick: handleAddDocument
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhum documento encontrado"
          description={searchValue
            ? "Tente ajustar os filtros ou termo de busca"
            : "Comece adicionando um novo documento financeiro"
          }
          actionLabel="Adicionar Documento"
          onAction={handleAddDocument}
        />
      ) : (
        <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {filteredDocs.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              variant={viewMode}
              config={DOC_TYPES[doc.tipo?.toLowerCase()] || { color: '#2E7D32', icon: DollarSign }}
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
          Categorias de Documentos Financeiros
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoriesWithCounts.map(category => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => onCategoryClick?.('financeiro', category.id)}
          />
        ))}
      </div>
    </div>
  )

  // Render archived documents
  const renderArchived = () => (
    <div className="space-y-4">
      <FilterBar
        searchPlaceholder="Buscar documentos arquivados..."
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
          title="Nenhum documento arquivado"
          description="Documentos arquivados aparecerao aqui"
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
          label="Total de Documentos"
          icon={FileText}
          color="#2E7D32"
        />
        <StatsCard
          value={stats.thisMonth}
          label="Adicionados este mes"
          icon={Plus}
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
          label="Arquivados"
          icon={Archive}
          color="#6B7280"
        />
      </div>

      <Card className="bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-2xl">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Documentos por Categoria
          </h3>
          <div className="space-y-3">
            {categoriesWithCounts.map(category => (
              <div key={category.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#2E7D32]/10">
                    <category.icon className="w-4 h-4 text-[#2E7D32] dark:text-[#2ECC71]" />
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
          <Icon className="w-8 h-8 text-[#2E7D32] dark:text-[#2ECC71]" />
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
              'bg-[#2E7D32] hover:bg-[#256B29] text-white',
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
          <div className="p-3 rounded-xl bg-[#2E7D32]/10 group-hover:bg-[#2E7D32]/20 transition-colors">
            <Icon className="w-6 h-6 text-[#2E7D32] dark:text-[#2ECC71]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-[#2E7D32] dark:group-hover:text-[#2ECC71] transition-colors">
              {category.label}
            </h4>
            <p className="text-xs text-[#6B7280] dark:text-[#A3B8B0] mt-0.5">
              {category.count} {category.count === 1 ? 'documento' : 'documentos'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default FinanceiroSection
