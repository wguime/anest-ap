/**
 * MinhasEscalasView — atalho pessoal: só os casos do usuário logado (filter-first).
 * Landing mobile. Casa o alias do usuário com a coluna anestesista (resolvida).
 * Trocas pendentes que ME envolvem aparecem aqui também — quem só usa esta aba
 * não pode depender da notificação para saber que há proposta esperando.
 */
import { useMemo, useState } from 'react'
import { CalendarClock, ChevronRight, Clock, Stethoscope } from 'lucide-react'
import { Badge, EmptyState } from '@/design-system'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { casosResolvidos, tipoBadge, normNome, filtrarPorTurno } from './utils'
import TrocaPendenteCard from './TrocaPendenteCard'
import TrocaSalaSheet from './TrocaSalaSheet'
import CasoDetalheSheet from './CasoDetalheSheet'

export default function MinhasEscalasView({ escala, meuAlias, meuUid, turno, onVerBoard }) {
  const alvo = normNome(meuAlias)
  const { trocasPendentes, aceitarTroca, recusarTroca, cancelarTroca } = useEscalaCirurgica()
  const [detalhe, setDetalhe] = useState(null)   // caso aberto (mesmo sheet da aba Completa)
  const [trocaSala, setTrocaSala] = useState(null)
  const isDemo = String(escala?.id).startsWith('demo-')
  // aqui todo caso é MEU → posso propor troca da minha própria sala
  const podeTrocarSala = (sala, aliasSala) => !isDemo && !!aliasSala
  // Identidade robusta: casa por login (uid) quando o caso tem; senão cai p/ o apelido (demo/legado).
  const meus = useMemo(
    () => filtrarPorTurno(casosResolvidos(escala), turno).filter((c) =>
      c.anestesistaUserId ? c.anestesistaUserId === meuUid : (alvo && normNome(c.anestesista) === alvo)
    ),
    [escala, alvo, meuUid, turno]
  )
  const minhasTrocas = useMemo(
    () => (trocasPendentes || []).filter(
      (t) => t.escalaId === escala?.id && (t.uidA === meuUid || t.uidB === meuUid)
    ),
    [trocasPendentes, escala?.id, meuUid]
  )
  const userInfo = { userId: meuUid }

  const blocoTrocas = minhasTrocas.length > 0 && (
    <div className="space-y-2">
      {minhasTrocas.map((t) => (
        <TrocaPendenteCard
          key={t.id}
          troca={t}
          meuUid={meuUid}
          podeGerenciar={false}
          onAceitar={(x) => aceitarTroca(x)}
          onRecusar={(x) => recusarTroca(x, userInfo)}
          onCancelar={(x) => cancelarTroca(x, userInfo)}
        />
      ))}
    </div>
  )

  if (!meus.length) {
    return (
      <div className="space-y-3">
        {blocoTrocas}
        <EmptyState
          icon={<CalendarClock className="w-6 h-6" />}
          title="Você não está escalado aqui"
          description="Nenhum caso encontrado para você neste hospital/data. Confira a escala completa."
          action={onVerBoard && { label: 'Ver completa', onClick: onVerBoard }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocoTrocas}
      <p className="text-xs text-muted-foreground px-1">
        {meus.length} {meus.length === 1 ? 'caso' : 'casos'} seu(s) neste hospital
      </p>
      {meus.map((caso) => {
        const tb = tipoBadge(caso.tipo)
        // clicável (pedido do dono 2026-07-21): abre o MESMO detalhe da aba
        // Completa — status + solicitar troca da própria sala
        return (
          <button
            type="button"
            key={caso.id || `${caso.sala}-${caso.ordem}`}
            onClick={() => setDetalhe(caso)}
            aria-label={`Detalhes do caso, ${caso.sala}, ${caso.procedimento || ''}`}
            className="w-full rounded-xl border border-primary/50 bg-primary/5 p-3 text-left transition-colors
                       active:bg-muted/60 supports-[hover:hover]:hover:bg-primary/10"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">{caso.sala}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {caso.hora || '—'}
                {caso.tempoEstimado && <span>· {caso.tempoEstimado}</span>}
                {tb && <Badge variant={tb.variant} badgeStyle={tb.style} className="ml-1">{tb.label}</Badge>}
                <ChevronRight className="ml-0.5 h-4 w-4" />
              </span>
            </div>
            {caso.procedimento && (
              <p className="text-[15px] text-foreground/90 mt-0.5">{caso.procedimento}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              {caso.cirurgiao && (
                <span className="inline-flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {caso.cirurgiao}</span>
              )}
              {(caso.pacienteIniciais || caso.idade) && (
                <span>{[caso.pacienteIniciais, caso.idade].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </button>
        )
      })}

      {detalhe && (
        <CasoDetalheSheet
          escala={escala}
          caso={detalhe}
          onClose={() => setDetalhe(null)}
          podeTrocarSala={podeTrocarSala}
          onTrocarSala={(sala) => setTrocaSala(sala)}
        />
      )}
      {trocaSala && (
        <TrocaSalaSheet
          escala={escala}
          salaAtual={trocaSala}
          meuUid={meuUid}
          podeAplicarDireto={false}
          onClose={() => setTrocaSala(null)}
        />
      )}
    </div>
  )
}
