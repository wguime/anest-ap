import { ChevronRight } from 'lucide-react'

export default function AreaProgressCard({ areaKey, progresso, areaConfig, onClick }) {
  const Icon = areaConfig.icon
  const { total, avaliados, conformes, parciais, naoConformes, percentual } = progresso
  const naoAvaliados = total - avaliados

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-card rounded-[20px] border border-border-strong p-4 hover:border-primary/20 transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Zona 1: Icon + Titulo + Score + Chevron */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-primary/20">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="flex-1 min-w-0 text-sm font-semibold text-foreground dark:text-white truncate">
          {areaConfig.title}
        </h3>
        <span className="text-sm font-bold text-primary tabular-nums shrink-0">{percentual}%</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>

      {/* Zona 2: Progresso + barra */}
      <div className="mt-2.5 ml-10">
        <div className="text-xs text-muted-foreground mb-1">
          {avaliados} de {total} ROPs avaliados
        </div>
        <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      {/* Zona 3: Resumo por status */}
      <div className="flex flex-wrap gap-3 mt-2.5 pt-2.5 ml-10 border-t border-border/60 text-[11px]">
        {conformes > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success shrink-0" />
            <span className="text-muted-foreground">{conformes} conforme{conformes !== 1 ? 's' : ''}</span>
          </span>
        )}
        {parciais > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
            <span className="text-muted-foreground">{parciais} parcial{parciais !== 1 ? 'is' : ''}</span>
          </span>
        )}
        {naoConformes > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
            <span className="text-muted-foreground">{naoConformes} NC</span>
          </span>
        )}
        {naoAvaliados > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{naoAvaliados} não avaliado{naoAvaliados !== 1 ? 's' : ''}</span>
          </span>
        )}
      </div>
    </button>
  )
}
