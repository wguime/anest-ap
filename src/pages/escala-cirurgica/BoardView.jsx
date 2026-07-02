/**
 * BoardView — visão COMPLETA da escala do hospital (todas as salas/casos).
 * Lista de cards agrupada por sala (mobile-first, sem grid). Toque no caso
 * abre um bottom-sheet com o detalhe.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, Clock, Stethoscope, UserRound, Timer, ArrowLeftRight } from 'lucide-react'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Badge, EmptyState,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { casosResolvidos, agruparPorSala, tipoBadge, normNome, filtrarPorTurno, compararSalas, anestesistaDaSala } from './utils'
import TrocaSalaSheet from './TrocaSalaSheet'
import TrocaPendenteCard from './TrocaPendenteCard'

function CasoCard({ caso, destaque, onClick }) {
  const tb = tipoBadge(caso.tipo)
  const rotulo = ['Detalhes do caso', caso.hora, caso.pacienteIniciais, caso.procedimento]
    .filter(Boolean).join(', ')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={[
        'w-full text-left rounded-xl border p-3 min-h-[44px] transition-colors',
        'active:bg-muted/60 hover:bg-muted/40',
        destaque ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {caso.hora && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {caso.hora}
              </span>
            )}
            {caso.pacienteIniciais && <span className="truncate">{caso.pacienteIniciais}</span>}
            {caso.idade && <span className="font-normal text-muted-foreground">{caso.idade}</span>}
            {tb && <Badge variant={tb.variant} badgeStyle="subtle">{tb.label}</Badge>}
          </div>
          {caso.procedimento && (
            <p className="text-sm text-foreground/90 truncate mt-0.5">{caso.procedimento}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {caso.cirurgiao && (
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> {caso.cirurgiao}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <UserRound className="w-3 h-3" /> {caso.anestesista || '—'}
            </span>
            {caso.tempoEstimado && (
              <span className="inline-flex items-center gap-1">
                <Timer className="w-3 h-3" /> {caso.tempoEstimado}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </button>
  )
}

export default function BoardView({ escala, meuAlias, meuUid, turno }) {
  const { user } = useUser()
  const { trocasPendentes, aceitarTroca, recusarTroca, cancelarTroca } = useEscalaCirurgica()
  const [detalhe, setDetalhe] = useState(null)
  const [trocaSala, setTrocaSala] = useState(null)
  const casos = useMemo(() => filtrarPorTurno(casosResolvidos(escala), turno), [escala, turno])
  const grupos = useMemo(() => agruparPorSala(casos), [casos])
  const alvo = normNome(meuAlias)
  const ehMeu = (c) => (c.anestesistaUserId ? c.anestesistaUserId === meuUid : alvo && normNome(c.anestesista) === alvo)

  const isDemo = String(escala?.id).startsWith('demo-')
  const role = (user?.role || '').toLowerCase()
  const podeGerenciar = !!(user?.isAdmin || role === 'secretaria')
  const userInfo = { userId: meuUid }
  const trocasDaSala = (sala) => (trocasPendentes || []).filter((t) => t.salaA === sala || t.salaB === sala)
  const souDaSala = (sala) => anestesistaDaSala(escala?.casos, sala).uid === meuUid
  const podeTrocarSala = (sala) => !isDemo && (podeGerenciar || souDaSala(sala)) && !!anestesistaDaSala(escala?.casos, sala).uid

  if (!escala || !escala.casos?.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Sem escala publicada"
        description="A escala deste hospital ainda não foi importada para esta data."
      />
    )
  }
  if (!casos.length) {
    return (
      <EmptyState
        icon={<Stethoscope className="w-6 h-6" />}
        title="Nenhum caso neste turno"
        description="Não há casos no turno selecionado. Troque para o outro turno."
      />
    )
  }

  const salas = [...grupos.keys()].sort(compararSalas(escala.hospital))

  return (
    <>
      <Accordion type="multiple" defaultValue={salas} className="space-y-2">
        {salas.map((sala) => {
          const lista = grupos.get(sala)
          const trocas = trocasDaSala(sala)
          // p/ exibição vale o apelido resolvido mesmo sem uid (demo/legado);
          // o chip de TROCA continua exigindo uid (podeTrocarSala)
          const aliasSala = anestesistaDaSala(escala?.casos, sala).alias
            || lista.find((c) => c.anestesista)?.anestesista || ''
          return (
            <AccordionItem key={sala} value={sala} className="rounded-xl border border-border bg-card">
              {/* sticky no <h3> do header (no button interno é inerte — h3 tem a altura dele) */}
              <AccordionTrigger
                className="px-3"
                headerClassName="sticky top-14 z-10 bg-card rounded-t-xl"
                actions={podeTrocarSala(sala) ? (
                  <button
                    type="button"
                    onClick={() => setTrocaSala(sala)}
                    aria-label={`Trocar sala de ${aliasSala}`}
                    className="mr-2 flex min-h-[44px] shrink-0 items-center gap-1 self-center rounded-lg
                               border border-border bg-muted/40 px-2.5 text-sm font-medium text-primary active:bg-muted"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" /> {aliasSala}
                  </button>
                ) : null}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0">{sala}</span>
                  <Badge variant="secondary" badgeStyle="subtle">{lista.length}</Badge>
                  {trocas.length > 0 && <Badge variant="warning" badgeStyle="subtle">Troca pendente</Badge>}
                  {!podeTrocarSala(sala) && aliasSala && (
                    <span className="truncate font-normal text-muted-foreground">— {aliasSala}</span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="space-y-2">
                  {trocas.map((t) => (
                    <TrocaPendenteCard
                      key={t.id}
                      troca={t}
                      meuUid={meuUid}
                      podeGerenciar={podeGerenciar}
                      onAceitar={(x) => aceitarTroca(x)}
                      onRecusar={(x) => recusarTroca(x, userInfo)}
                      onCancelar={(x) => cancelarTroca(x, userInfo)}
                    />
                  ))}
                  {lista.map((caso) => (
                    <CasoCard
                      key={caso.id || `${sala}-${caso.ordem}`}
                      caso={caso}
                      destaque={ehMeu(caso)}
                      onClick={() => setDetalhe(caso)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>{detalhe?.sala} · {detalhe?.hora}</SheetTitle>
          </SheetHeader>
          {detalhe && (
            <dl className="px-1 pb-4 space-y-2 text-sm">
              <Linha rotulo="Paciente" valor={detalhe.pacienteIniciais} />
              <Linha rotulo="Idade" valor={detalhe.idade} />
              <Linha rotulo="Procedimento" valor={detalhe.procedimento} />
              <Linha rotulo="Cirurgião" valor={detalhe.cirurgiao} />
              <Linha rotulo="Anestesista" valor={detalhe.anestesista} destaque />
              <Linha rotulo="Convênio" valor={detalhe.convenio} />
              <Linha rotulo="Tempo estimado" valor={detalhe.tempoEstimado} />
              {tipoBadge(detalhe.tipo) && (
                <Linha rotulo="Tipo" valor={tipoBadge(detalhe.tipo).label} />
              )}
            </dl>
          )}
        </SheetContent>
      </Sheet>

      {trocaSala && (
        <TrocaSalaSheet
          escala={escala}
          salaAtual={trocaSala}
          meuUid={meuUid}
          podeAplicarDireto={podeGerenciar}
          onClose={() => setTrocaSala(null)}
        />
      )}
    </>
  )
}

function Linha({ rotulo, valor, destaque }) {
  if (!valor) return null
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className={destaque ? 'font-semibold text-foreground' : 'text-foreground/90'}>{valor}</dd>
    </div>
  )
}
