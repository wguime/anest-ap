/**
 * MinhasEscalasView — atalho pessoal: só os casos do usuário logado (filter-first).
 * Landing mobile. Casa o alias do usuário com a coluna anestesista (resolvida).
 * Trocas pendentes que ME envolvem aparecem aqui também — quem só usa esta aba
 * não pode depender da notificação para saber que há proposta esperando.
 */
import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { EmptyState } from '@/design-system'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { casosResolvidos, normNome, filtrarPorTurno, salaExibicao } from './utils'
import { CasoCard } from './BoardView'
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
      {/* MESMO card da aba Completa (pedido do dono 2026-07-21), com a sala no cabeçalho */}
      {meus.map((caso) => (
        <CasoCard
          key={caso.id || `${caso.sala}-${caso.ordem}`}
          caso={caso}
          salaLabel={salaExibicao(caso.sala)}
          destaque
          onClick={() => setDetalhe(caso)}
        />
      ))}

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
