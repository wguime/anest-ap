/**
 * MinhasEscalasView — atalho pessoal: só os casos do usuário logado (filter-first).
 * Landing mobile. Casa o alias do usuário com a coluna anestesista (resolvida).
 * Sistema de trocas APOSENTADO (decisão do dono 2026-07-23) — quem quer repassar
 * uma sala usa "Definir anestesista da sala" (no detalhe do caso ou na Completa).
 */
import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { EmptyState } from '@/design-system'
import { casosResolvidos, normNome, filtrarPorTurno, salaExibicao } from './utils'
import { CasoCard } from './BoardView'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import CasoDetalheSheet from './CasoDetalheSheet'

export default function MinhasEscalasView({ escala, meuAlias, meuUid, turno, onVerBoard }) {
  const alvo = normNome(meuAlias)
  const [detalhe, setDetalhe] = useState(null)   // caso aberto (mesmo sheet da aba Completa)
  const [definir, setDefinir] = useState(null)   // { sala, caso? }
  const isDemo = String(escala?.id).startsWith('demo-')
  // aqui todo caso é MEU → posso repassar a minha própria sala
  const podeDefinirAnestesista = () => !isDemo
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
        description="Nenhum caso encontrado para você neste hospital/data. Confira a escala completa."
        action={onVerBoard && { label: 'Ver completa', onClick: onVerBoard }}
      />
    )
  }

  return (
    <div className="space-y-2">
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
          podeDefinirAnestesista={podeDefinirAnestesista}
          onDefinirAnestesista={(sala, casoAlvo) => setDefinir({ sala, caso: casoAlvo || null })}
        />
      )}
      {definir && (
        <DefinirAnestesistaSheet
          escala={escala}
          sala={definir.sala}
          caso={definir.caso || null}
          onClose={() => setDefinir(null)}
        />
      )}
    </div>
  )
}
