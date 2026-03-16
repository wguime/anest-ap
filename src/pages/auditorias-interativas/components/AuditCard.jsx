/**
 * AuditCard - Card de listagem para uma execucao de auditoria
 *
 * Layout uniforme em 3 zonas:
 *   Zona 1: Icon + Titulo (line-clamp-2) + Chevron
 *   Zona 2: Badges (tipo + status) — sempre cabe em 1 linha
 *   Zona 3: Meta (setor + data à esquerda | score ou prazo à direita)
 */
import { Badge } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { getAuditoriaTipoConfig } from '@/data/auditoriasConfig'
import { EXECUCAO_STATUS } from '@/data/auditoriaTemplatesConfig'
import { Calendar, ChevronRight, MapPin } from 'lucide-react'
import DeadlineBadge from '@/components/DeadlineBadge'

// Mesma lógica de cores do progresso: verde alto, âmbar médio, vermelho baixo
function getScoreColor(score) {
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-destructive'
}

export default function AuditCard({ execucao, onClick }) {
  const tipoConfig = getAuditoriaTipoConfig(execucao.templateTipo)
  const statusConfig = EXECUCAO_STATUS[execucao.status] || EXECUCAO_STATUS.rascunho
  const TipoIcon = tipoConfig.icon

  const dataFormatada = execucao.dataAuditoria
    ? new Date(execucao.dataAuditoria + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '-'

  const isConcluida = execucao.status === 'concluida'
  const hasScore = isConcluida && execucao.scoreConformidade != null
  const hasPrazo = !isConcluida && execucao.prazo

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left bg-card rounded-[20px] border border-border-strong p-3 sm:p-4',
        'hover:border-primary/20 transition-all active:scale-[0.99] touch-manipulation'
      )}
    >
      {/* Zona 1: Icon + Titulo + Chevron */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
          <TipoIcon className="w-5 h-5 text-primary" />
        </div>

        <h3 className="flex-1 min-w-0 text-[13px] sm:text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {execucao.titulo}
        </h3>

        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {/* Zona 2: Badges — tipo à esquerda, status à direita */}
      <div className="flex items-center justify-between gap-2 mt-2 ml-[52px]">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary shrink-0">
          {tipoConfig.label}
        </span>
        <Badge
          variant={isConcluida ? 'success' : execucao.status === 'em_andamento' ? 'warning' : 'secondary'}
          badgeStyle="subtle"
          className="text-[11px] shrink-0 ml-auto"
        >
          {statusConfig.label}
        </Badge>
      </div>

      {/* Zona 3: Meta (setor + data à esquerda | score/prazo alinhado à direita) */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 ml-[52px] border-t border-border/60">
        <div className="flex items-center gap-3 text-[12px] sm:text-[11px] text-muted-foreground min-w-0">
          {execucao.setorNome && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {execucao.setorNome}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            {dataFormatada}
          </span>
        </div>

        <div className="shrink-0 ml-auto">
          {hasScore ? (
            <span className={cn('text-[13px] sm:text-sm font-bold tabular-nums', getScoreColor(execucao.scoreConformidade))}>
              {execucao.scoreConformidade}%
            </span>
          ) : hasPrazo ? (
            <DeadlineBadge prazo={execucao.prazo} compact />
          ) : null}
        </div>
      </div>
    </button>
  )
}
