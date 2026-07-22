/**
 * CirurgiasParticularesPage - Listagem/relatório de cobranças de cirurgias
 * particulares por período (conferência e auditoria).
 *
 * A listagem É o relatório em tela: período livre (De/Até), tabs por status
 * de pagamento, busca, totais do período e exportação PDF.
 * LGPD: nome completo do paciente exibido apenas aqui (RLS por papel);
 * nunca logar dados do paciente no console.
 */
import { useState, useMemo, useEffect } from 'react'
import { Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Card, Button, Badge, Tabs, TabsList, TabsTrigger, EmptyState, SearchBar,
  SearchToggleButton, Collapsible, CollapsibleContent, DatePicker, ConfirmDialog,
} from '@/design-system'
import { useToast } from '@/design-system'
import { PageHeader } from '@/components'
import ExportButton from '@/components/ExportButton'
import { useUser } from '@/contexts/UserContext'
import { useCirurgiasParticulares } from '@/contexts/CirurgiasParticularesContext'
import { usePdfExport } from '@/hooks/usePdfExport'
import supabaseEscalaCirurgicaService from '@/services/supabaseEscalaCirurgicaService'
import { requireUserId } from '@/utils/audit'
import { toLocalISODate } from '@/utils/dateUtils'
import { formatCurrency } from '@/utils/formatters'
import {
  STATUS_PAGAMENTO, STATUS_LABEL, STATUS_BADGE_VARIANT,
  filtrarAtivas, filtrarPorPeriodo, computeTotais, resumoPorAnestesista, precisaCompletar,
} from '@/lib/cirurgiasParticulares'

// Exibe YYYY-MM-DD como DD/MM/YYYY sem passar por Date (fuso).
const fmtDataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')

const primeiroDiaDoMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function CirurgiaCard({ cirurgia, suspensaNaEscala, onClick, onMarcarPago, onCancelarSuspensa }) {
  const status = cirurgia.statusPagamento || 'pendente'
  return (
    <Card className="p-4">
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{fmtDataBR(cirurgia.dataCirurgia)} · {cirurgia.local}</p>
            <p className="text-sm font-semibold text-foreground truncate">{cirurgia.paciente}</p>
            <p className="text-xs text-muted-foreground truncate">{cirurgia.procedimento}</p>
            <p className="text-xs text-muted-foreground truncate">
              Cir.: {cirurgia.cirurgiao} · Anest.: {cirurgia.anestesistaNome}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(cirurgia.valor)}</p>
            {/* Rascunho do auto-import (publicação da escala): falta nome e/ou valor */}
            {precisaCompletar(cirurgia) ? (
              <Badge variant="warning" badgeStyle="solid">Completar dados</Badge>
            ) : (
              <Badge variant={STATUS_BADGE_VARIANT[status] || 'default'} badgeStyle="subtle">
                {STATUS_LABEL[status] || status}
              </Badge>
            )}
            {status === 'pago' && cirurgia.dataPagamento && (
              <p className="text-[11px] text-muted-foreground">em {fmtDataBR(cirurgia.dataPagamento)}</p>
            )}
          </div>
        </div>
      </button>

      {/* Alerta: caso vinculado foi SUSPENSO na escala depois do lançamento */}
      {suspensaNaEscala && (
        <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/30">
          <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Suspensa na escala — conferir
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 min-h-0 px-2 text-xs text-destructive"
            onClick={onCancelarSuspensa}
          >
            Cancelar lançamento
          </Button>
        </div>
      )}

      {/* Quick action nº 1 da conferência: marcar como pago.
          Rascunho incompleto primeiro completa (abre o form no toque). */}
      {status !== 'pago' && !precisaCompletar(cirurgia) && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-8 min-h-0 px-3 text-xs"
            onClick={onMarcarPago}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Marcar como pago
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function CirurgiasParticularesPage({ onNavigate, goBack }) {
  const { user } = useUser()
  const { cirurgias, loading, updateCirurgia, cancelarCirurgia } = useCirurgiasParticulares()
  const { exportPdf, exporting } = usePdfExport()
  const { toast } = useToast()

  const [inicio, setInicio] = useState(() => primeiroDiaDoMes())
  const [fim, setFim] = useState(() => new Date())
  const [statusTab, setStatusTab] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  // { tipo: 'pagar' | 'cancelar-suspensa', cirurgia }
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  // id do caso da escala -> statusExtra atual ('suspensa' interessa)
  const [casoStatusById, setCasoStatusById] = useState({})

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchTerm('')
  }

  useEffect(() => {
    if (!searchOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeSearch() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  const inicioISO = inicio ? toLocalISODate(inicio) : null
  const fimISO = fim ? toLocalISODate(fim) : null

  // Ativas no período (todas as tabs partem daqui; totais refletem o período)
  const doPeriodo = useMemo(() => {
    const ativas = filtrarAtivas(cirurgias)
    const periodo = filtrarPorPeriodo(ativas, inicioISO, fimISO)
    return [...periodo].sort((a, b) => (b.dataCirurgia || '').localeCompare(a.dataCirurgia || ''))
  }, [cirurgias, inicioISO, fimISO])

  const filtradas = useMemo(() => {
    let result = doPeriodo
    if (statusTab !== 'todos') {
      result = result.filter((c) => c.statusPagamento === statusTab)
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (c) =>
          (c.paciente || '').toLowerCase().includes(term) ||
          (c.cirurgiao || '').toLowerCase().includes(term) ||
          (c.anestesistaNome || '').toLowerCase().includes(term)
      )
    }
    return result
  }, [doPeriodo, statusTab, searchTerm])

  const totais = useMemo(() => computeTotais(doPeriodo), [doPeriodo])

  // Pós-lançamento: caso vinculado pode ter sido SUSPENSO na escala.
  // Batch-check dos vinculados visíveis; id não encontrado (escala
  // republicada) = sem informação, sem alerta.
  useEffect(() => {
    const ids = [...new Set(doPeriodo.map((c) => c.escalaCasoId).filter(Boolean))]
    if (!ids.length) {
      setCasoStatusById({})
      return
    }
    let cancelled = false
    supabaseEscalaCirurgicaService
      .fetchCasosStatus(ids)
      .then((rows) => {
        if (cancelled) return
        setCasoStatusById(Object.fromEntries(rows.map((r) => [r.id, r])))
      })
      .catch(() => {
        // Alerta é best-effort: falha de rede não pode quebrar a listagem.
        if (!cancelled) setCasoStatusById({})
      })
    return () => { cancelled = true }
  }, [doPeriodo])

  const handleExportPdf = async () => {
    if (!filtradas.length) {
      toast({ title: 'Nada a exportar', description: 'Nenhuma cirurgia no filtro atual.', variant: 'warning' })
      return
    }
    await exportPdf('cirurgiasParticularesReport', {
      registros: filtradas,
      periodo: { inicio: inicioISO, fim: fimISO },
      statusFiltro: statusTab === 'todos' ? null : STATUS_LABEL[statusTab],
      totais: computeTotais(filtradas),
      resumoAnestesistas: resumoPorAnestesista(filtradas),
      geradoPor: user?.displayName || user?.email || '',
      geradoPorUid: user?.uid || user?.id || '',
    })
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setConfirmLoading(true)
    try {
      const audited = requireUserId(
        { userId: user?.uid || user?.id, userName: user?.displayName },
        'CirurgiasParticularesPage.confirmAction'
      )
      if (confirmAction.tipo === 'pagar') {
        await updateCirurgia(
          confirmAction.cirurgia.id,
          { statusPagamento: 'pago', dataPagamento: toLocalISODate(new Date()) },
          audited
        )
        toast({ title: 'Pagamento registrado', description: 'Cirurgia marcada como paga.', variant: 'success' })
      } else {
        await cancelarCirurgia(confirmAction.cirurgia.id, 'Cirurgia suspensa na escala', audited)
        toast({ title: 'Lançamento cancelado', description: 'Registro cancelado (suspensa na escala).', variant: 'success' })
      }
      setConfirmAction(null)
    } catch (err) {
      toast({ title: 'Erro', description: err.message || 'Tente novamente.', variant: 'error' })
    } finally {
      setConfirmLoading(false)
    }
  }

  const isSearching = searchTerm.trim().length > 0

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Cirurgias Particulares"
        onBack={goBack}
        actions={
          <div className="flex items-center gap-2">
            <SearchToggleButton
              active={searchOpen}
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            />
            <Button
              size="sm"
              variant="default"
              className="h-7 min-h-0 px-2.5 text-xs"
              onClick={() => onNavigate('novaCirurgiaParticular')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Nova
            </Button>
          </div>
        }
      />

      <div className="px-4 sm:px-5 pt-2">
        <Collapsible open={searchOpen} onOpenChange={(v) => (v ? setSearchOpen(true) : closeSearch())}>
          <CollapsibleContent>
            <div className="mb-3">
              <SearchBar
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar paciente, cirurgião, anestesista..."
                autoFocus
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Período do relatório — bounds inclusivos, min/max cruzados */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <DatePicker
            label="De"
            placeholder="Início"
            value={inicio}
            onChange={setInicio}
            maxDate={fim || undefined}
          />
          <DatePicker
            label="Até"
            placeholder="Fim"
            value={fim}
            onChange={setFim}
            minDate={inicio || undefined}
          />
        </div>

        {/* Totais do período (independem da tab/busca) */}
        <Card className="p-4 mb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {totais.total.count} cirurgia{totais.total.count !== 1 ? 's' : ''} no período
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(totais.total.valor)}</p>
            </div>
            <ExportButton size="sm" onExport={handleExportPdf} loading={exporting} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {STATUS_PAGAMENTO.map((s) => (
              <div key={s.value} className="rounded-xl bg-muted/50 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">{s.label} ({totais.porStatus[s.value].count})</p>
                <p className="text-xs font-semibold text-foreground tabular-nums">
                  {formatCurrency(totais.porStatus[s.value].valor)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Tabs value={statusTab} onValueChange={setStatusTab} variant="default">
          <TabsList className="mb-3">
            <TabsTrigger value="todos">Todas ({totais.total.count})</TabsTrigger>
            {STATUS_PAGAMENTO.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label === 'Pendente' ? 'Pendentes' : s.label === 'Pago' ? 'Pagas' : 'Glosadas'} ({totais.porStatus[s.value].count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isSearching && (
          <p className="text-xs text-muted-foreground mb-3">
            {filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            title="Nenhuma cirurgia no filtro"
            description={
              isSearching || statusTab !== 'todos'
                ? 'Tente ajustar a busca, o status ou o período.'
                : 'Registre a primeira cirurgia particular do período.'
            }
            action={
              !isSearching && statusTab === 'todos'
                ? { label: 'Nova cirurgia', onClick: () => onNavigate('novaCirurgiaParticular') }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filtradas.map((cirurgia) => (
              <CirurgiaCard
                key={cirurgia.id}
                cirurgia={cirurgia}
                suspensaNaEscala={
                  !!cirurgia.escalaCasoId &&
                  casoStatusById[cirurgia.escalaCasoId]?.statusExtra === 'suspensa'
                }
                onClick={() => onNavigate('novaCirurgiaParticular', { cirurgiaId: cirurgia.id })}
                onMarcarPago={() => setConfirmAction({ tipo: 'pagar', cirurgia })}
                onCancelarSuspensa={() => setConfirmAction({ tipo: 'cancelar-suspensa', cirurgia })}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        loading={confirmLoading}
        variant={confirmAction?.tipo === 'cancelar-suspensa' ? 'danger' : 'default'}
        title={confirmAction?.tipo === 'cancelar-suspensa' ? 'Cancelar lançamento?' : 'Marcar como pago?'}
        description={
          confirmAction?.tipo === 'cancelar-suspensa'
            ? `A cirurgia de ${confirmAction?.cirurgia?.paciente || ''} foi suspensa na escala. O lançamento será cancelado (a trilha fica registrada).`
            : `Registrar pagamento de ${formatCurrency(confirmAction?.cirurgia?.valor)} com data de hoje.`
        }
        confirmText={confirmAction?.tipo === 'cancelar-suspensa' ? 'Cancelar lançamento' : 'Marcar pago'}
      />
    </div>
  )
}
