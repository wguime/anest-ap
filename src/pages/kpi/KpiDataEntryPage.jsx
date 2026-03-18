import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Database, Loader2 } from 'lucide-react'
import { Select, Progress, Button, Spinner } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useKpiData } from '@/hooks/useKpiData'
import { useUser } from '@/contexts/UserContext'
import KpiEntryRow from './components/KpiEntryRow'

const MESES_OPTIONS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Marco' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const ANO_OPTIONS = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
]

/**
 * KpiDataEntryPage - Admin page for monthly KPI data entry
 * Route: kpiDataEntry
 */
export default function KpiDataEntryPage({ onNavigate, goBack }) {
  const { user } = useUser()
  const isAdmin = user?.isAdmin || user?.role === 'Administrador' || user?.isCoordenador

  // Default to current month and year
  const now = new Date()
  const [ano, setAno] = useState(String(now.getFullYear()))
  const [mes, setMes] = useState(String(now.getMonth() + 1))

  const { indicadores, loading, error, upsertDado, validateDado } = useKpiData({ ano: parseInt(ano, 10) })

  const mesNum = parseInt(mes, 10)

  // Count indicators that have data for selected month
  const progressInfo = useMemo(() => {
    const total = indicadores.length
    const comDados = indicadores.filter((ind) => {
      const detalhe = ind.mesesDetalhados?.[mesNum - 1]
      return detalhe?.hasData
    }).length
    return { total, comDados, pct: total > 0 ? Math.round((comDados / total) * 100) : 0 }
  }, [indicadores, mesNum])

  // Handle save for a single indicator row
  const handleSave = useCallback(
    async (indicadorId, mesVal, data) => {
      await upsertDado({
        indicadorId,
        ano: parseInt(ano, 10),
        mes: mesVal,
        ...data,
      })
    },
    [ano, upsertDado]
  )

  // Handle validation
  const handleValidate = useCallback(
    async (dadoId) => {
      await validateDado(dadoId, {
        uid: user?.uid || user?.id,
        nome: user?.displayName || user?.firstName || 'Admin',
      })
    },
    [validateDado, user]
  )

  // Header via portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => (goBack ? goBack() : onNavigate('qualidade'))}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Coleta de Dados KPI
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Selectors: Year + Month */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Select
            label="Ano"
            options={ANO_OPTIONS}
            value={ano}
            onChange={(val) => setAno(val)}
            size="sm"
          />
          <Select
            label="Mes"
            options={MESES_OPTIONS}
            value={mes}
            onChange={(val) => setMes(val)}
            size="sm"
          />
        </div>

        {/* Progress bar */}
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Progresso da Coleta - {MESES_OPTIONS.find((m) => m.value === mes)?.label} {ano}
              </p>
              <p className="text-xs text-muted-foreground">
                {progressInfo.comDados} de {progressInfo.total} indicadores preenchidos
              </p>
            </div>
            <span className="text-lg font-bold text-primary">
              {progressInfo.pct}%
            </span>
          </div>
          <Progress
            value={progressInfo.pct}
            variant={progressInfo.pct >= 100 ? 'success' : progressInfo.pct >= 50 ? 'warning' : 'error'}
            size="md"
          />
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner className="w-8 h-8 text-primary" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-700 dark:text-red-300">Erro ao carregar dados: {error}</p>
          </div>
        )}

        {/* Entry rows grid */}
        {!loading && !error && (
          <div className="space-y-3">
            {indicadores.map((ind) => (
              <KpiEntryRow
                key={ind.id}
                indicador={ind}
                mes={mesNum}
                onSave={handleSave}
                onValidate={handleValidate}
                disabled={!isAdmin}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
