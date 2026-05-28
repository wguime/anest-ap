/**
 * CateteresPeridualPage - Listagem de cateteres peridurais por hospital
 */
import { useState, useMemo } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import { Card, Input, Tabs, TabsList, TabsTrigger, EmptyState } from '@/design-system'
import { useCateterPeridural } from '@/contexts/CateterPeridualContext'
import { getAlertLevel, HOSPITAIS } from '@/data/cateterPeridualConfig'
import CateterCard from './components/CateterCard'

function HospitalTab({ cateteres, loading, statusFilter, setStatusFilter, searchTerm, setSearchTerm, onNavigate, hospitalKey, onCateterClick }) {
  const hospitalCateteres = useMemo(
    () => cateteres.filter((c) => c.hospital === hospitalKey),
    [cateteres, hospitalKey]
  )

  const stats = useMemo(() => {
    const ativos = hospitalCateteres.filter((c) => c.status === 'ativo')
    const alertas = ativos.filter((c) => getAlertLevel(c.dataInsercao) !== 'normal')
    return { ativos: ativos.length, alertas: alertas.length, total: hospitalCateteres.length }
  }, [hospitalCateteres])

  const filteredCateteres = useMemo(() => {
    let result = [...hospitalCateteres]

    if (statusFilter !== 'todos') {
      result = result.filter((c) => c.status === statusFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (c) =>
          c.paciente.toLowerCase().includes(term) ||
          (c.leito && c.leito.toLowerCase().includes(term)) ||
          (c.anestesista && c.anestesista.toLowerCase().includes(term))
      )
    }

    return result
  }, [hospitalCateteres, statusFilter, searchTerm])

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-foreground">{stats.ativos}</p>
          <p className="text-[11px] text-muted-foreground">Ativos</p>
        </Card>
        <Card className="p-3 text-center">
          <p className={`text-lg font-bold ${stats.alertas > 0 ? 'text-warning' : 'text-foreground'}`}>
            {stats.alertas}
          </p>
          <p className="text-[11px] text-muted-foreground">Alertas</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground">Total</p>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-3">
        <Input
          variant="search"
          placeholder="Buscar paciente, leito..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Status filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} variant="default">
        <TabsList className="mb-3">
          <TabsTrigger value="ativo">
            Ativos ({stats.ativos})
          </TabsTrigger>
          <TabsTrigger value="retirado">
            Retirados ({stats.total - stats.ativos})
          </TabsTrigger>
          <TabsTrigger value="todos">
            Todos ({stats.total})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      <p className="text-xs text-muted-foreground mb-3">
        {filteredCateteres.length} cateter{filteredCateteres.length !== 1 ? 'es' : ''} encontrado{filteredCateteres.length !== 1 ? 's' : ''}
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
      ) : filteredCateteres.length === 0 ? (
        <EmptyState
          title="Nenhum cateter encontrado"
          description={
            searchTerm || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros de busca.'
              : `Cadastre o primeiro cateter para ${HOSPITAIS[hospitalKey].label}.`
          }
          action={
            !searchTerm && statusFilter === 'todos'
              ? {
                  label: 'Novo Cateter',
                  onClick: () => onNavigate('novoCateter'),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredCateteres.map((cateter) => (
            <CateterCard
              key={cateter.id}
              cateter={cateter}
              onClick={() => onCateterClick(cateter)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CateteresPeridualPage({ onNavigate, goBack, params }) {
  const { cateteres, loading } = useCateterPeridural()
  // Lazy init: restaura hospital se voltamos via goBack do detalhe (params.hospital)
  const [hospitalTab, setHospitalTab] = useState(() => {
    const initial = params?.hospital
    return initial && HOSPITAIS[initial] ? initial : 'unimed'
  })
  const [statusFilter, setStatusFilter] = useState('ativo')
  const [searchTerm, setSearchTerm] = useState('')

  // Ao abrir detalhe, captura hospital atual em pageParams da página corrente
  // para que goBack restaure a aba correta.
  const handleCateterClick = (cateter) => {
    onNavigate(
      'cateterDetalhe',
      { id: cateter.id },
      { hospital: hospitalTab }
    )
  }

  const ativosPorHospital = useMemo(() => {
    const counts = {}
    for (const key of Object.keys(HOSPITAIS)) counts[key] = 0
    for (const c of cateteres) {
      if (c.status === 'ativo' && counts[c.hospital] !== undefined) {
        counts[c.hospital] += 1
      }
    }
    return counts
  }, [cateteres])

  // Reset status filter and search when switching hospital
  const handleHospitalChange = (val) => {
    setHospitalTab(val)
    setStatusFilter('ativo')
    setSearchTerm('')
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Header with hospital tabs */}
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
              Cateter Peridural
            </h1>
            <div className="min-w-[70px] flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('novoCateter', null, { hospital: hospitalTab })}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo
              </button>
            </div>
          </div>
        </div>
        {/* Hospital toggle inside header */}
        <div className="flex border-t border-border">
          {Object.entries(HOSPITAIS).map(([key, h]) => {
            const ativos = ativosPorHospital[key] || 0
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleHospitalChange(key)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  hospitalTab === key
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {h.label}
                  {ativos > 0 && (
                    <span
                      aria-label={`${ativos} cateter${ativos !== 1 ? 'es' : ''} ativo${ativos !== 1 ? 's' : ''}`}
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none bg-[#DC2626] text-white dark:bg-[#2ECC71] dark:text-[#002215] shadow-[0_0_8px_rgba(220,38,38,0.25)] dark:shadow-[0_0_10px_rgba(46,204,113,0.35)]"
                    >
                      {ativos}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="h-[88px]" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-3">
        <HospitalTab
          cateteres={cateteres}
          loading={loading}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNavigate={onNavigate}
          hospitalKey={hospitalTab}
          onCateterClick={handleCateterClick}
        />
      </div>
    </div>
  )
}
