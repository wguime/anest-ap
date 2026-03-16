/**
 * PlanosAcaoPage - Listagem e dashboard de planos de acao (PDCA)
 */
import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  Plus,
  LayoutGrid,
  BarChart3,
} from 'lucide-react'
import {
  Card,
  Badge,
  Input,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { usePlanosAcao } from '@/contexts/PlanosAcaoContext'
import { PLANO_STATUS, PRIORIDADES, PDCA_PHASES } from '@/data/planosAcaoConfig'
import PlanoAcaoCard from './components/PlanoAcaoCard'
import PlanoAcaoDashboard from './components/PlanoAcaoDashboard'

export default function PlanosAcaoPage({ onNavigate, goBack, embedded = false }) {
  const { planos, loading } = usePlanosAcao()
  const [activeTab, setActiveTab] = useState('lista')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [prioridadeFilter, setPrioridadeFilter] = useState('todos')

  // Callback quando um status e clicado no dashboard (DonutChart)
  const handleDashboardStatusClick = (statusKey) => {
    setStatusFilter(statusKey)
    setActiveTab('lista')
  }

  const filteredPlanos = useMemo(() => {
    let result = [...planos]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (p) =>
          p.titulo.toLowerCase().includes(term) ||
          (p.descricao && p.descricao.toLowerCase().includes(term)) ||
          (p.responsavelNome && p.responsavelNome.toLowerCase().includes(term))
      )
    }

    if (statusFilter !== 'todos') {
      result = result.filter((p) => p.status === statusFilter)
    }

    if (prioridadeFilter !== 'todos') {
      result = result.filter((p) => p.prioridade === prioridadeFilter)
    }

    return result
  }, [planos, searchTerm, statusFilter, prioridadeFilter])

  const handlePlanoClick = (plano) => {
    onNavigate('planoAcaoDetalhe', { id: plano.id })
  }

  if (embedded) {
    return (
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="default">
          <TabsList className="mb-4">
            <TabsTrigger value="lista" icon={<LayoutGrid className="w-4 h-4" />}>
              Lista
            </TabsTrigger>
            <TabsTrigger value="dashboard" icon={<BarChart3 className="w-4 h-4" />}>
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            {/* Filters */}
            <div className="space-y-3 mb-4">
              <Input
                variant="search"
                placeholder="Buscar planos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  options={[
                    { value: 'todos', label: 'Todos os status' },
                    ...Object.entries(PLANO_STATUS).map(([key, config]) => ({
                      value: key,
                      label: config.label,
                    })),
                  ]}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  size="sm"
                  placeholder="Status"
                />
                <Select
                  options={[
                    { value: 'todos', label: 'Todas prioridades' },
                    ...Object.entries(PRIORIDADES).map(([key, config]) => ({
                      value: key,
                      label: config.label,
                    })),
                  ]}
                  value={prioridadeFilter}
                  onChange={(val) => setPrioridadeFilter(val)}
                  size="sm"
                  placeholder="Prioridade"
                />
              </div>
            </div>

            {/* Results count */}
            <p className="text-xs text-muted-foreground mb-3">
              {filteredPlanos.length} plano{filteredPlanos.length !== 1 ? 's' : ''} encontrado{filteredPlanos.length !== 1 ? 's' : ''}
            </p>

            {/* List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : filteredPlanos.length === 0 ? (
              <EmptyState
                title="Nenhum plano encontrado"
                description={searchTerm || statusFilter !== 'todos' || prioridadeFilter !== 'todos'
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Crie o primeiro plano de acao para comecar.'}
                action={
                  !searchTerm && statusFilter === 'todos' && prioridadeFilter === 'todos'
                    ? {
                        label: 'Criar Plano de Acao',
                        onClick: () => onNavigate('novoPlanoAcao'),
                      }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredPlanos.map((plano) => (
                  <PlanoAcaoCard
                    key={plano.id}
                    plano={plano}
                    onClick={() => handlePlanoClick(plano)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dashboard">
            <PlanoAcaoDashboard planos={planos} onStatusClick={handleDashboardStatusClick} />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border-strong shadow-sm">
        <div className="px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-[70px]">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </button>
            </div>
            <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
              Planos de Acao
            </h1>
            <div className="min-w-[70px] flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('novoPlanoAcao')}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="default">
          <TabsList className="mb-4">
            <TabsTrigger value="lista" icon={<LayoutGrid className="w-4 h-4" />}>
              Lista
            </TabsTrigger>
            <TabsTrigger value="dashboard" icon={<BarChart3 className="w-4 h-4" />}>
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <div className="space-y-3 mb-4">
              <Input
                variant="search"
                placeholder="Buscar planos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  options={[
                    { value: 'todos', label: 'Todos os status' },
                    ...Object.entries(PLANO_STATUS).map(([key, config]) => ({
                      value: key,
                      label: config.label,
                    })),
                  ]}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  size="sm"
                  placeholder="Status"
                />
                <Select
                  options={[
                    { value: 'todos', label: 'Todas prioridades' },
                    ...Object.entries(PRIORIDADES).map(([key, config]) => ({
                      value: key,
                      label: config.label,
                    })),
                  ]}
                  value={prioridadeFilter}
                  onChange={(val) => setPrioridadeFilter(val)}
                  size="sm"
                  placeholder="Prioridade"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              {filteredPlanos.length} plano{filteredPlanos.length !== 1 ? 's' : ''} encontrado{filteredPlanos.length !== 1 ? 's' : ''}
            </p>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : filteredPlanos.length === 0 ? (
              <EmptyState
                title="Nenhum plano encontrado"
                description={searchTerm || statusFilter !== 'todos' || prioridadeFilter !== 'todos'
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Crie o primeiro plano de acao para comecar.'}
                action={
                  !searchTerm && statusFilter === 'todos' && prioridadeFilter === 'todos'
                    ? {
                        label: 'Criar Plano de Acao',
                        onClick: () => onNavigate('novoPlanoAcao'),
                      }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredPlanos.map((plano) => (
                  <PlanoAcaoCard
                    key={plano.id}
                    plano={plano}
                    onClick={() => handlePlanoClick(plano)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dashboard">
            <PlanoAcaoDashboard planos={planos} onStatusClick={handleDashboardStatusClick} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
