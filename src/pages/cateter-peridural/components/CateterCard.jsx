/**
 * CateterCard - Card for catheter list display
 */
import { Activity, Clock, MapPin, User } from 'lucide-react'
import { Card, Badge } from '@/design-system'
import { CATETER_STATUS, calcHorasCateter, getAlertLevel } from '@/data/cateterPeridualConfig'

export default function CateterCard({ cateter, onClick }) {
  const statusConfig = CATETER_STATUS[cateter.status] || CATETER_STATUS.ativo
  const horas = calcHorasCateter(cateter.dataInsercao)
  const dias = Math.floor(horas / 24)
  const alertLevel = cateter.status === 'ativo' ? getAlertLevel(cateter.dataInsercao) : 'normal'

  return (
    <Card
      className={`p-4 cursor-pointer active:scale-[0.98] transition-all ${
        alertLevel === 'critical'
          ? 'border-red-300 dark:border-red-700'
          : alertLevel === 'warning'
            ? 'border-amber-300 dark:border-amber-700'
            : ''
      }`}
      onClick={onClick}
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
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span
                className={`text-xs font-medium ${
                  alertLevel === 'critical'
                    ? 'text-red-600 dark:text-red-400'
                    : alertLevel === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                }`}
              >
                {dias > 0 ? `${dias}d ` : ''}{horas % 24}h ativo
              </span>
            </div>
          )}
        </div>

        <Badge variant={statusConfig.variant} badgeStyle="solid">
          {statusConfig.label}
        </Badge>
      </div>
    </Card>
  )
}
