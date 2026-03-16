/**
 * AlertaDuracao - Banner de alerta para duração do cateter (72h warning / 96h critical)
 */
import { AlertTriangle, Clock } from 'lucide-react'
import { calcHorasCateter, getAlertLevel, WARNING_DURATION_HOURS, MAX_DURATION_HOURS } from '@/data/cateterPeridualConfig'

export default function AlertaDuracao({ dataInsercao }) {
  const level = getAlertLevel(dataInsercao)
  const horas = calcHorasCateter(dataInsercao)

  if (level === 'normal') return null

  const dias = Math.floor(horas / 24)
  const horasRestantes = horas % 24

  const isCritical = level === 'critical'

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        isCritical
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
      }`}
    >
      <AlertTriangle
        className={`w-5 h-5 flex-shrink-0 ${
          isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            isCritical ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
          }`}
        >
          {isCritical ? 'Duração crítica!' : 'Atenção: duração elevada'}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          <Clock className="w-3 h-3 inline mr-1" />
          {dias}d {horasRestantes}h desde inserção
          {isCritical
            ? ` — excedeu ${MAX_DURATION_HOURS}h. Considere retirada.`
            : ` — próximo de ${MAX_DURATION_HOURS}h.`}
        </p>
      </div>
    </div>
  )
}
