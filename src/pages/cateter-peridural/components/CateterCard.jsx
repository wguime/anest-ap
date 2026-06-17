/**
 * CateterCard - Card for catheter list display
 * Memoizado para evitar re-renders quando contextos globais atualizam.
 */
import { memo } from 'react'
import { Activity, AlertTriangle, Clock, MapPin, User } from 'lucide-react'
import { Card, Badge } from '@/design-system'
import { CATETER_STATUS, calcHorasCateter, getAlertLevel, calcHorasSemAvaliacao, getEvolucaoAlertLevel, formatDuracaoHoras } from '@/data/cateterPeridualConfig'

const CateterCard = memo(function CateterCard({ cateter, onClick }) {
  const statusConfig = CATETER_STATUS[cateter.status] || CATETER_STATUS.ativo
  const horas = calcHorasCateter(cateter.dataInsercao)
  const dias = Math.floor(horas / 24)
  const alertLevel = cateter.status === 'ativo' ? getAlertLevel(cateter.dataInsercao) : 'normal'

  // Alerta de "não evoluído" — eixo distinto da duração total.
  const evolucaoLevel =
    cateter.status === 'ativo'
      ? getEvolucaoAlertLevel(cateter.ultimaAvaliacaoAt, cateter.dataInsercao)
      : 'normal'
  const horasSemAv = calcHorasSemAvaliacao(cateter.ultimaAvaliacaoAt, cateter.dataInsercao)

  // Borda por precedência: duração crítica > não-evoluído crítico > duração warning > não-evoluído warning.
  const borderClass =
    alertLevel === 'critical' || evolucaoLevel === 'critical'
      ? 'border-destructive'
      : alertLevel === 'warning' || evolucaoLevel === 'warning'
        ? 'border-warning'
        : ''

  const alertaSuffix =
    alertLevel === 'critical' ? ', duração crítica' : alertLevel === 'warning' ? ', em alerta de duração' : ''
  const evolucaoSuffix = evolucaoLevel !== 'normal' ? ', sem evolução recente' : ''
  const ariaLabel = `Cateter de ${cateter.paciente}, ${statusConfig.label}${alertaSuffix}${evolucaoSuffix}. Abrir detalhe.`

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`p-4 cursor-pointer active:scale-[0.98] transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${borderClass}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">
              {cateter.paciente}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {cateter.leito && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Leito {cateter.leito}
              </span>
            )}
            {cateter.nivelPuncao && (
              <span>Nível: {cateter.nivelPuncao}</span>
            )}
            {cateter.tamanhoCpd && (
              <span>{cateter.tamanhoCpd}</span>
            )}
          </div>

          {cateter.status === 'ativo' && (
            <>
              <div className="flex items-center gap-1 mt-1.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span
                  className={`text-xs font-medium ${
                    alertLevel === 'critical'
                      ? 'text-destructive'
                      : alertLevel === 'warning'
                        ? 'text-warning'
                        : 'text-muted-foreground'
                  }`}
                >
                  {dias > 0 ? `${dias}d ` : ''}{horas % 24}h ativo
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Activity className="w-3 h-3 text-muted-foreground" />
                <span
                  className={`text-xs font-medium ${
                    evolucaoLevel === 'critical'
                      ? 'text-destructive'
                      : evolucaoLevel === 'warning'
                        ? 'text-warning'
                        : 'text-muted-foreground'
                  }`}
                >
                  {cateter.ultimaAvaliacaoAt
                    ? `${formatDuracaoHoras(horasSemAv)} desde evolução`
                    : 'Sem evolução registrada'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant={statusConfig.variant} badgeStyle="solid">
            {statusConfig.label}
          </Badge>
          {evolucaoLevel !== 'normal' && (
            <Badge
              variant={evolucaoLevel === 'critical' ? 'destructive' : 'warning'}
              badgeStyle="subtle"
              className="text-[10px] gap-1 whitespace-nowrap"
            >
              <AlertTriangle className="w-3 h-3" />
              Sem evolução há {horasSemAv}h
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
})

export default CateterCard
