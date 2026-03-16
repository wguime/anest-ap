/**
 * PlanoAcaoCard - Card para listagem de planos de acao
 */
import { Card, Badge, Progress } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { Calendar, User, ArrowRight } from 'lucide-react'
import { PLANO_STATUS, PRIORIDADES, PDCA_PHASES, TIPO_ORIGEM } from '@/data/planosAcaoConfig'

const PDCA_LABEL_PT = {
  plan: 'Planejar',
  do: 'Executar',
  check: 'Verificar',
  act: 'Padronizar',
}

function getPdcaProgress(fasePdca) {
  const phases = ['plan', 'do', 'check', 'act']
  const idx = phases.indexOf(fasePdca)
  return idx >= 0 ? ((idx + 1) / 4) * 100 : 0
}

function isOverdue(prazo, status) {
  if (!prazo || status === 'concluido' || status === 'cancelado') return false
  return new Date(prazo) < new Date()
}

export default function PlanoAcaoCard({ plano, onClick }) {
  const statusConfig = PLANO_STATUS[plano.status] || PLANO_STATUS.planejamento
  const prioridadeConfig = PRIORIDADES[plano.prioridade] || PRIORIDADES.media
  const phaseConfig = PDCA_PHASES[plano.fasePdca] || PDCA_PHASES.plan
  const origemConfig = TIPO_ORIGEM[plano.tipoOrigem] || TIPO_ORIGEM.manual
  const overdue = isOverdue(plano.prazo, plano.status)
  const progress = plano.status === 'concluido' ? 100 : getPdcaProgress(plano.fasePdca)

  const StatusIcon = statusConfig.icon
  const PrioridadeIcon = prioridadeConfig.icon
  const PhaseIcon = phaseConfig.icon

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      className="rounded-[20px] border border-border-strong bg-card text-card-foreground p-4 shadow-sm"
    >
      {/* Título e origem */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {plano.titulo}
          </h3>
          {plano.origemDescricao && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {plano.origemDescricao}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>

      {/* Prioridade + fase (esquerda) | Status + Atrasado (direita) - cores do config (DS + padrão internacional) */}
      <div className="flex justify-between items-center gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge variant={prioridadeConfig.variant} badgeStyle="subtle" className="shrink-0">
            <PrioridadeIcon className="w-3 h-3 mr-1" />
            {prioridadeConfig.label}
          </Badge>
          <Badge variant="secondary" badgeStyle="subtle" className="shrink-0">
            <PhaseIcon className="w-3 h-3 mr-1" />
            {PDCA_LABEL_PT[plano.fasePdca] || phaseConfig.shortLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={statusConfig.variant} badgeStyle="subtle">
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
          {overdue && (
            <Badge variant="destructive" badgeStyle="solid">
              Atrasado
            </Badge>
          )}
        </div>
      </div>

      {/* Progresso PDCA - variants success/warning/default do DS */}
      <div className="mb-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso PDCA</span>
          <span className="font-semibold tabular-nums text-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress
          value={progress}
          className="h-1.5"
          variant={progress === 100 ? 'success' : progress >= 50 ? 'warning' : 'error'}
        />
      </div>

      {/* Responsável e prazo */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="flex items-center gap-1.5 truncate min-w-0">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate text-foreground">{plano.responsavelNome || 'Nao atribuido'}</span>
        </span>
        {plano.prazo && (
          <span className={cn('flex items-center gap-1.5 shrink-0', overdue && 'text-destructive font-medium')}>
            <Calendar className="w-3 h-3" />
            {new Date(plano.prazo).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </Card>
  )
}
