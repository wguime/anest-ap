/**
 * MinhasEscalasView — atalho pessoal: só os casos do usuário logado (filter-first).
 * Landing mobile. Casa o alias do usuário com a coluna anestesista (resolvida).
 * Sistema de trocas APOSENTADO (decisão do dono 2026-07-23) — quem quer repassar
 * uma sala usa "Definir anestesista da sala" (no detalhe do caso ou na Completa).
 */
import { useMemo, useState } from 'react'
import { CalendarClock, MapPin, Moon } from 'lucide-react'
import { Badge, EmptyState } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { ehPosicaoAssistencial, resumirItensEscala } from '@/lib/escalaCirurgicaItens'
import { anestesistaDoCasoEh, casosResolvidos, filtrarPorTurnoExibicao, limparConcluidosNaVirada, salaExibicao, visaoNoturna } from './utils'
import { podeEditarEscalaCirurgica } from './gate'
import { CasoCard } from './BoardView'
import useAgoraMinutoEscala from './useAgoraMinutoEscala'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import CasoDetalheSheet from './CasoDetalheSheet'
import AddCasoSheet from './AddCasoSheet'

export default function MinhasEscalasView({ escala, meuAlias, meuUid, turno, onVerBoard }) {
  const { user } = useUser()
  const [detalhe, setDetalhe] = useState(null)   // caso aberto (mesmo sheet da aba Completa)
  const [definir, setDefinir] = useState(null)   // { sala, caso? }
  // Editar o caso é o MESMO formulário do "Adicionar" (dono 01/09) e vale nas
  // TRÊS abas: o detalhe aqui é o mesmo componente, e um botão que só funciona
  // na Completa seria a "aba pela metade" que a Minhas deixou de ser em 29/07.
  const [editando, setEditando] = useState(null)
  const isDemo = String(escala?.id).startsWith('demo-')
  const agoraMin = useAgoraMinutoEscala() // um intervalo p/ a lista (tempo faltante dos casos)
  const { hoje } = useEscalaCirurgica()
  // VIRADA DAS 19h (dono 17/09): a mesma regra da Completa — sai o que JÁ
  // ESTAVA terminado/suspenso às 19h; o que termina depois fica. Minhas
  // cirurgias da tarde já fechadas são poluição para quem segue de plantão.
  const noite = visaoNoturna({ agoraMin, dataEscala: escala?.data, hojeIso: hoje, turno })
  // CARD IDÊNTICO AO DA COMPLETA (dono 29/07): sem `podeEditar` o sheet escondia
  // residente, tempo da cirurgia, ajuda e "trocar sala/local" — o detalhe aberto
  // pela Minhas vinha pela metade, e mudar algo numa aba não aparecia na outra
  // porque na Minhas não havia como mudar. É o MESMO componente das outras duas
  // abas; a diferença tinha de ser só QUAIS casos a lista mostra.
  const podeEditarCaso = podeEditarEscalaCirurgica(user) && !isDemo
  const podeDefinirAnestesista = () => podeEditarCaso
  // Identidade robusta: casa por login (uid) quando o caso tem; senão cai p/ o apelido (demo/legado).
  // O RESIDENTE (dono 29/07) também tem os casos dele aqui: ele acompanha por
  // `residenteUserId`, que só existe via seletor — sempre uid, nunca texto.
  const meusDoTurno = useMemo(
    () => filtrarPorTurnoExibicao(casosResolvidos(escala), turno).filter((c) =>
      (!!meuUid && c.residenteUserId === meuUid)
      // dupla "A + B" entra para as DUAS (o helper trata; uid é null nela)
      || anestesistaDoCasoEh(c, { uid: meuUid, alias: meuAlias })
    ),
    [escala, meuAlias, meuUid, turno]
  )
  const meus = useMemo(
    () => (noite ? limparConcluidosNaVirada(meusDoTurno, { dataEscala: escala?.data }) : meusDoTurno),
    [meusDoTurno, noite, escala?.data],
  )

  // Tinha caso e a noite escondeu tudo: dizer isso, não "você não está escalado".
  if (!meus.length && meusDoTurno.length) {
    return (
      <EmptyState
        icon={<Moon className="w-6 h-6" />}
        title="Nenhuma cirurgia sua em andamento"
        description="Na virada das 19h saem as cirurgias já terminadas ou suspensas — as suas da tarde já tinham acabado."
        action={onVerBoard && { label: 'Ver completa', onClick: onVerBoard }}
      />
    )
  }
  if (!meus.length) {
    return (
      <EmptyState
        icon={<CalendarClock className="w-6 h-6" />}
        title="Você não está escalado aqui"
        description="Nenhuma cirurgia ou posição encontrada para você neste hospital/data. Confira a escala completa."
        action={onVerBoard && { label: 'Ver completa', onClick: onVerBoard }}
      />
    )
  }

  const resumo = resumirItensEscala(meus)
  const resumoPartes = [
    resumo.cirurgias ? `${resumo.cirurgias} ${resumo.cirurgias === 1 ? 'cirurgia' : 'cirurgias'}` : '',
    resumo.posicoes ? `${resumo.posicoes} ${resumo.posicoes === 1 ? 'posição' : 'posições'}` : '',
  ].filter(Boolean)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">
        {resumoPartes.join(' + ')} neste hospital
      </p>
      {/* MESMO card da aba Completa (pedido do dono 2026-07-21), com a sala no cabeçalho */}
      {meus.map((caso) => (ehPosicaoAssistencial(caso) ? (
        <div
          key={caso.id || `${caso.sala}-${caso.ordem}`}
          className="flex min-h-[64px] items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{salaExibicao(caso.sala)}</p>
            <p className="text-xs text-muted-foreground">Local de trabalho neste turno</p>
          </div>
          <Badge variant="secondary" className="shrink-0">Posição</Badge>
        </div>
      ) : (
        <CasoCard
          key={caso.id || `${caso.sala}-${caso.ordem}`}
          caso={caso}
          salaLabel={salaExibicao(caso.sala)}
          destaque
          agoraMin={agoraMin}
          onClick={() => setDetalhe(caso)}
        />
      )))}

      {detalhe && (
        <CasoDetalheSheet
          escala={escala}
          caso={detalhe}
          turno={turno}
          onClose={() => setDetalhe(null)}
          podeEditar={podeEditarCaso}
          podeDefinirAnestesista={podeDefinirAnestesista}
          onDefinirAnestesista={(sala, casoAlvo) => setDefinir({ sala, casosAlvo: casoAlvo ? [casoAlvo] : null })}
          onEditarCaso={(alvo) => { setDetalhe(null); setEditando(alvo) }}
        />
      )}
      {editando && (
        <AddCasoSheet
          escala={escala}
          turno={turno}
          caso={editando}
          onClose={() => setEditando(null)}
        />
      )}
      {definir && (
        <DefinirAnestesistaSheet
          escala={escala}
          sala={definir.sala}
          casosAlvo={definir.casosAlvo || null}
          turno={turno}
          onClose={() => setDefinir(null)}
        />
      )}
    </div>
  )
}
