/**
 * MinhasEscalasView — atalho pessoal: só os casos do usuário logado (filter-first).
 * Landing mobile. Casa o alias do usuário com a coluna anestesista (resolvida).
 */
import { useMemo } from 'react'
import { CalendarClock, Clock, Stethoscope } from 'lucide-react'
import { Badge, EmptyState } from '@/design-system'
import { casosResolvidos, tipoBadge, normNome, filtrarPorTurno } from './utils'

export default function MinhasEscalasView({ escala, meuAlias, meuUid, turno, onVerBoard }) {
  const alvo = normNome(meuAlias)
  // Identidade robusta: casa por login (uid) quando o caso tem; senão cai p/ o apelido (demo/legado).
  const meus = useMemo(
    () => filtrarPorTurno(casosResolvidos(escala), turno).filter((c) =>
      c.anestesistaUserId ? c.anestesistaUserId === meuUid : (alvo && normNome(c.anestesista) === alvo)
    ),
    [escala, alvo, meuUid, turno]
  )

  if (!meus.length) {
    return (
      <EmptyState
        icon={<CalendarClock className="w-6 h-6" />}
        title="Você não está escalado aqui"
        description="Nenhum caso encontrado para você neste hospital/data. Confira o board completo."
        action={onVerBoard && { label: 'Ver board', onClick: onVerBoard }}
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">
        {meus.length} {meus.length === 1 ? 'caso' : 'casos'} seu(s) neste hospital
      </p>
      {meus.map((caso) => {
        const tb = tipoBadge(caso.tipo)
        return (
          <div key={caso.id || `${caso.sala}-${caso.ordem}`} className="rounded-xl border border-primary/50 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">{caso.sala}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {caso.hora || '—'}
                {caso.tempoEstimado && <span>· {caso.tempoEstimado}</span>}
                {tb && <Badge variant={tb.variant} badgeStyle="subtle" className="ml-1">{tb.label}</Badge>}
              </span>
            </div>
            {caso.procedimento && (
              <p className="text-sm text-foreground/90 mt-0.5">{caso.procedimento}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              {caso.cirurgiao && (
                <span className="inline-flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {caso.cirurgiao}</span>
              )}
              {(caso.pacienteIniciais || caso.idade) && (
                <span>{[caso.pacienteIniciais, caso.idade].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
