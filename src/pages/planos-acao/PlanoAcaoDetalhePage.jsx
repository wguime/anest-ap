/**
 * PlanoAcaoDetalhePage - Detalhe/edicao de plano de acao com ciclo PDCA
 */
import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  Save,
  ArrowRight,
  Calendar,
  User,
  Clock,
  Tag,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import {
  Card,
  Badge,
  Button,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Timeline,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useUser } from '@/contexts/UserContext'
import { usePlanosAcao } from '@/contexts/PlanosAcaoContext'
import {
  PLANO_STATUS,
  PRIORIDADES,
  PDCA_PHASES,
  PDCA_PHASE_ORDER,
  TIPO_ORIGEM,
} from '@/data/planosAcaoConfig'
import PdcaStepper from './components/PdcaStepper'
import EficaciaEvaluation from './components/EficaciaEvaluation'

function InfoRow({ icon: Icon, label, value, valueClassName }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-sm text-foreground', valueClassName)}>
          {value || 'Nao informado'}
        </p>
      </div>
    </div>
  )
}

export default function PlanoAcaoDetalhePage({ onNavigate, goBack, params }) {
  const { user } = useUser()
  const { planos, updatePlano, advancePdcaPhase, evaluateEficacia } = usePlanosAcao()
  const [novaEvidencia, setNovaEvidencia] = useState('')
  const [saving, setSaving] = useState(false)

  const plano = useMemo(
    () => planos.find((p) => p.id === params?.id),
    [planos, params?.id]
  )

  if (!plano) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border-strong shadow-sm">
          <div className="px-4 sm:px-5 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 text-primary-hover dark:text-primary"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </button>
            </div>
          </div>
        </nav>
        <div className="h-14" />
        <div className="px-4 py-8 text-center text-muted-foreground">
          Plano de acao nao encontrado.
        </div>
      </div>
    )
  }

  const statusConfig = PLANO_STATUS[plano.status] || PLANO_STATUS.planejamento
  const prioridadeConfig = PRIORIDADES[plano.prioridade] || PRIORIDADES.media
  const phaseConfig = PDCA_PHASES[plano.fasePdca] || PDCA_PHASES.plan
  const origemConfig = TIPO_ORIGEM[plano.tipoOrigem] || TIPO_ORIGEM.manual

  const isOverdue =
    plano.prazo &&
    plano.status !== 'concluido' &&
    plano.status !== 'cancelado' &&
    new Date(plano.prazo) < new Date()

  const canAdvancePhase =
    plano.status !== 'concluido' && plano.status !== 'cancelado'
  const currentPhaseIdx = PDCA_PHASE_ORDER.indexOf(plano.fasePdca)
  const nextPhase = currentPhaseIdx < 3 ? PDCA_PHASE_ORDER[currentPhaseIdx + 1] : null

  const handleAdvancePhase = async () => {
    if (!nextPhase) return
    setSaving(true)
    try {
      await advancePdcaPhase(plano.id, nextPhase)
    } catch (err) {
      console.error('[PlanoDetalhe] Error advancing phase:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEficaciaSubmit = async ({ eficacia, justificativa }) => {
    setSaving(true)
    try {
      await evaluateEficacia(plano.id, eficacia, justificativa)
    } catch (err) {
      console.error('[PlanoDetalhe] Error evaluating eficacia:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddEvidencia = async () => {
    if (!novaEvidencia.trim()) return
    setSaving(true)
    try {
      const newEvidencia = {
        descricao: novaEvidencia.trim(),
        data: new Date().toISOString(),
        autor: user?.displayName || 'Sistema',
      }
      await updatePlano({
        ...plano,
        evidencias: [...(plano.evidencias || []), newEvidencia],
      })
      setNovaEvidencia('')
    } catch (err) {
      console.error('[PlanoDetalhe] Error adding evidencia:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleConcluir = async () => {
    setSaving(true)
    try {
      await updatePlano({ ...plano, status: 'concluido' })
    } catch (err) {
      console.error('[PlanoDetalhe] Error concluding:', err)
    } finally {
      setSaving(false)
    }
  }

  const timelineItems = (plano.historico || []).map((h) => ({
    title: h.acao,
    description: h.autor,
    date: new Date(h.data).toLocaleDateString('pt-BR'),
  }))

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
              Plano de Acao
            </h1>
            <div className="min-w-[70px]" />
          </div>
        </div>
      </nav>

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Title & Badges */}
        <div className="bg-card rounded-[20px] border border-border-strong p-4">
          <h2 className="text-base font-semibold text-foreground dark:text-white">
            {plano.titulo}
          </h2>
          {plano.descricao && (
            <p className="text-sm text-muted-foreground mt-1">
              {plano.descricao}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <Badge variant={statusConfig.variant} badgeStyle="solid">
              {statusConfig.label}
            </Badge>
            <Badge variant={prioridadeConfig.variant} badgeStyle="subtle">
              {prioridadeConfig.label}
            </Badge>
            <Badge variant="secondary" badgeStyle="subtle">
              {origemConfig.label}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" badgeStyle="solid">
                Atrasado
              </Badge>
            )}
          </div>
        </div>

        {/* PDCA Stepper */}
        <div className="bg-card rounded-[20px] border border-border-strong p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Ciclo PDCA
          </h3>
          <PdcaStepper currentPhase={plano.fasePdca} />

          {canAdvancePhase && nextPhase && (
            <div className="mt-4 pt-3 border-t border-border">
              <Button
                variant="default"
                className="w-full"
                onClick={handleAdvancePhase}
                disabled={saving}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Avancar para {PDCA_PHASES[nextPhase]?.shortLabel}
              </Button>
            </div>
          )}

          {plano.fasePdca === 'act' && plano.status !== 'concluido' && (
            <div className="mt-3">
              <Button
                variant="success"
                className="w-full"
                onClick={handleConcluir}
                disabled={saving}
              >
                Concluir Plano de Acao
              </Button>
            </div>
          )}
        </div>

        {/* Tabs: Detalhes, Evidencias, Historico, Eficacia */}
        <Tabs defaultValue="detalhes" variant="underline">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias</TabsTrigger>
            <TabsTrigger value="historico">Historico</TabsTrigger>
            {plano.fasePdca === 'check' || plano.fasePdca === 'act' || plano.status === 'concluido' ? (
              <TabsTrigger value="eficacia">Eficacia</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="detalhes">
            <Card className="p-4 space-y-1">
              <InfoRow icon={User} label="Responsavel" value={plano.responsavelNome} />
              <InfoRow
                icon={Calendar}
                label="Prazo"
                value={plano.prazo ? new Date(plano.prazo).toLocaleDateString('pt-BR') : null}
                valueClassName={isOverdue ? 'text-destructive font-medium' : undefined}
              />
              <InfoRow icon={FileText} label="Origem" value={plano.origemDescricao} />
              <InfoRow
                icon={Clock}
                label="Criado em"
                value={plano.createdAt ? new Date(plano.createdAt).toLocaleDateString('pt-BR') : null}
              />
              <InfoRow
                icon={Clock}
                label="Atualizado em"
                value={plano.updatedAt ? new Date(plano.updatedAt).toLocaleDateString('pt-BR') : null}
              />
              {plano.tags && plano.tags.length > 0 && (
                <div className="flex items-start gap-3 py-2">
                  <Tag className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {plano.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" badgeStyle="subtle">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="evidencias">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Evidencias ({(plano.evidencias || []).length})
              </h3>

              {(plano.evidencias || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma evidencia registrada.
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {plano.evidencias.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <p className="text-sm text-foreground">{ev.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ev.autor} - {new Date(ev.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {plano.status !== 'concluido' && plano.status !== 'cancelado' && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <Textarea
                    placeholder="Descreva a evidencia..."
                    value={novaEvidencia}
                    onChange={(e) => setNovaEvidencia(e.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddEvidencia}
                    disabled={!novaEvidencia.trim() || saving}
                  >
                    Adicionar Evidencia
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Historico de Alteracoes
              </h3>
              {timelineItems.length > 0 ? (
                <Timeline items={timelineItems} />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum registro no historico.
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="eficacia">
            <EficaciaEvaluation
              currentEficacia={plano.eficacia}
              onSubmit={handleEficaciaSubmit}
              disabled={saving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
