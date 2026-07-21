/**
 * BoardView — visão COMPLETA da escala do hospital (todas as salas/casos).
 * Lista de cards agrupada por sala (mobile-first, sem grid). Toque no caso
 * abre um bottom-sheet com o detalhe.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, Clock, Stethoscope, Timer, ArrowLeftRight, Plus } from 'lucide-react'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Badge, Button, EmptyState,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { casosResolvidos, agruparPorSala, tipoBadge, corConvenio, normNome, filtrarPorTurno, compararSalas, anestesistaDaSala } from './utils'
import TrocaSalaSheet from './TrocaSalaSheet'
import TrocaPendenteCard from './TrocaPendenteCard'
import AddCasoSheet from './AddCasoSheet'

const STATUS_CIRURGIA = {
  iniciada: { label: 'Iniciada', variant: 'warning', card: 'border-warning bg-warning/25' },
  terminada: { label: 'Terminada', variant: 'success', card: 'border-success bg-success/25' },
  // atrasada = âmbar em OUTLINE (tinta leve) p/ não confundir com o âmbar cheio da iniciada
  atrasada: { label: 'Atrasada', variant: 'warning', badgeStyle: 'outline', card: 'border-warning/70 bg-warning/10' },
  suspensa: { label: 'Suspensa', variant: 'destructive', card: 'border-border bg-muted/50 opacity-60' },
  passa_tarde: { label: 'Passa p/ tarde', variant: 'info', card: 'border-info/70 bg-info/15 dark:bg-info/20' },
}

function CasoCard({ caso, destaque, onClick }) {
  const tb = tipoBadge(caso.tipo)
  const st = STATUS_CIRURGIA[caso.statusCirurgia]
  const conv = corConvenio(caso.convenio)
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
        st ? st.card : destaque ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
        // convênio identifica pela LATERAL — o fundo do card pertence ao status
        conv ? `border-l-4 ${conv.stripe}` : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Zona 1 — quando/quem: hora fixa à esquerda, paciente+idade, badges de tipo/status */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {caso.hora && (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {caso.hora}
              </span>
            )}
            {caso.pacienteIniciais && (
              <span className="max-w-[8rem] truncate font-semibold text-foreground" title={caso.pacienteIniciais}>
                {caso.pacienteIniciais}
              </span>
            )}
            {caso.idade && <span className="text-muted-foreground">{caso.idade}</span>}
            {tb && <Badge variant={tb.variant} badgeStyle="subtle">{tb.label}</Badge>}
            {st && <Badge variant={st.variant} badgeStyle={st.badgeStyle}>{st.label}</Badge>}
          </div>
          {/* Zona 2 — procedimento */}
          {caso.procedimento && (
            <p className="mt-1 truncate text-sm text-foreground/90" title={caso.procedimento}>{caso.procedimento}</p>
          )}
          {/* Zona 3 — cirurgião em destaque (o anestesista já está no título da sala) */}
          {caso.cirurgiao && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Stethoscope className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" title={caso.cirurgiao}>{caso.cirurgiao}</span>
            </p>
          )}
          {/* Zona 4 — rodapé: tempo estimado (convênio subiu p/ o topo, junto da seta) */}
          {caso.tempoEstimado && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" /> {caso.tempoEstimado}
            </div>
          )}
        </div>
        {/* coluna fixa no canto superior direito: convênio + seta (não entra no wrap da linha 1) */}
        <div className="flex shrink-0 items-center gap-1">
          {caso.convenio && (
            <span className={`max-w-[110px] truncate rounded-md px-1.5 py-0.5 text-xs font-medium ${conv?.badge || ''}`}
              title={caso.convenio}>
              {caso.convenio}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  )
}

export default function BoardView({ escala, meuAlias, meuUid, turno }) {
  const { user } = useUser()
  const { trocasPendentes, aceitarTroca, recusarTroca, cancelarTroca } = useEscalaCirurgica()
  const { setStatusCirurgia } = useEscalaCirurgicaActions()
  const [detalhe, setDetalhe] = useState(null)
  const [trocaSala, setTrocaSala] = useState(null)
  const [addCaso, setAddCaso] = useState(false)
  const casos = useMemo(() => filtrarPorTurno(casosResolvidos(escala), turno), [escala, turno])
  const grupos = useMemo(() => agruparPorSala(casos), [casos])
  const alvo = normNome(meuAlias)
  const ehMeu = (c) => (c.anestesistaUserId ? c.anestesistaUserId === meuUid : alvo && normNome(c.anestesista) === alvo)

  const isDemo = String(escala?.id).startsWith('demo-')
  const role = (user?.role || '').toLowerCase()
  const podeGerenciar = !!(user?.isAdmin || role === 'secretaria')
  const canEdit = !!(user?.isAdmin || ['anestesiologista', 'medico-residente', 'secretaria'].includes(role))
  const userInfo = { userId: meuUid }
  const trocasDaSala = (sala) => (trocasPendentes || []).filter((t) => t.salaA === sala || t.salaB === sala)
  // Identidade com fallback por apelido: escala real pode vir sem uid nos casos
  // (secretária não atribuiu logins) — a resolução final acontece na TrocaSalaSheet.
  const souDaSala = (sala) => {
    const { uid, alias } = anestesistaDaSala(escala?.casos, sala)
    if (uid) return uid === meuUid
    const primeiro = (escala?.casos || []).find((c) => c.sala === sala && c.anestesista)
    return !!(alvo && primeiro && normNome(primeiro.anestesista) === alvo) || !!(alias && alvo && normNome(alias) === alvo)
  }
  const podeTrocarSala = (sala, aliasSala) => !isDemo && !!aliasSala && (podeGerenciar || souDaSala(sala))

  const mudarStatus = async (status) => {
    if (!detalhe) return
    await setStatusCirurgia(escala, detalhe, status)
    setDetalhe({ ...detalhe, statusCirurgia: status })
  }

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
      {canEdit && !isDemo && (
        <Button size="sm" variant="outline" onClick={() => setAddCaso(true)} className="mb-2 w-full">
          <Plus className="w-4 h-4" /> Adicionar caso (urgência/encaixe)
        </Button>
      )}
      <Accordion type="multiple" defaultValue={salas} className="space-y-2">
        {salas.map((sala) => {
          const lista = grupos.get(sala)
          const trocas = trocasDaSala(sala)
          // p/ exibição vale o apelido resolvido mesmo sem uid (demo/legado);
          // a resolução de uid p/ TROCA acontece na sheet (dicionário + backfill)
          const aliasSala = anestesistaDaSala(escala?.casos, sala).alias
            || lista.find((c) => c.anestesista)?.anestesista || ''
          const trocavel = podeTrocarSala(sala, aliasSala)
          return (
            <AccordionItem key={sala} value={sala} className="rounded-xl border border-border bg-card">
              {/* sticky no <h3> do header (no button interno é inerte — h3 tem a altura dele) */}
              <AccordionTrigger
                className="px-3"
                headerClassName="sticky top-14 z-10 bg-card rounded-t-xl"
                actions={trocavel ? (
                  <button
                    type="button"
                    onClick={() => setTrocaSala(sala)}
                    aria-label={`Trocar sala de ${aliasSala}`}
                    className="flex min-h-[44px] min-w-[48px] shrink-0 items-center justify-center self-stretch
                               rounded-tr-xl pr-1 text-primary transition-colors active:opacity-60
                               group-data-[state=open]:bg-muted dark:group-data-[state=open]:bg-card"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                ) : null}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className="shrink-0">{sala}</span>
                  <Badge variant="secondary" badgeStyle="subtle">{lista.length}</Badge>
                  {trocas.length > 0 && <Badge variant="warning" badgeStyle="subtle">Troca pendente</Badge>}
                  {aliasSala && (
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
            <>
              <dl className="px-1 pb-2 space-y-2 text-sm">
                <Linha rotulo="Paciente" valor={detalhe.pacienteIniciais} />
                <Linha rotulo="Idade" valor={detalhe.idade} />
                <Linha rotulo="Procedimento" valor={detalhe.procedimento} />
                <Linha rotulo="Cirurgião" valor={detalhe.cirurgiao} />
                <Linha rotulo="Anestesista" valor={detalhe.anestesista} destaque />
                <Linha rotulo="Convênio" valor={detalhe.convenio && (
                  <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${corConvenio(detalhe.convenio)?.badge || ''}`}>
                    {detalhe.convenio}
                  </span>
                )} />
                <Linha rotulo="Tempo estimado" valor={detalhe.tempoEstimado} />
                {tipoBadge(detalhe.tipo) && (
                  <Linha rotulo="Tipo" valor={tipoBadge(detalhe.tipo).label} />
                )}
              </dl>
              {/* troca de sala a partir do caso (pedido do dono): mesmo fluxo do chip do título */}
              {(() => {
                const aliasDet = anestesistaDaSala(escala?.casos, detalhe.sala).alias || detalhe.anestesista || ''
                return podeTrocarSala(detalhe.sala, aliasDet) ? (
                  <div className="px-1 pb-2">
                    <Button size="sm" variant="outline" className="w-full"
                      onClick={() => { setDetalhe(null); setTrocaSala(detalhe.sala) }}>
                      <ArrowLeftRight className="w-4 h-4" /> Trocar sala ({aliasDet})
                    </Button>
                  </div>
                ) : null
              })()}
              {/* status da cirurgia — qualquer clínico atualiza (RLS cobre) */}
              {!isDemo && detalhe.id && (
                <div className="px-1 pb-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status da cirurgia
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { valor: 'agendada', label: 'Agendada', ativo: 'default' },
                      { valor: 'iniciada', label: 'Iniciada', ativo: 'warning' },
                      { valor: 'terminada', label: 'Terminada', ativo: 'success' },
                      { valor: 'atrasada', label: 'Atrasada', ativo: 'warning' },
                      { valor: 'suspensa', label: 'Suspensa', ativo: 'destructive' },
                      // Button não tem variant info — token via className (sem hex cru)
                      { valor: 'passa_tarde', label: 'P/ tarde', ativo: 'default', cls: 'bg-info text-white hover:bg-info/90' },
                    ].map((s) => {
                      const atual = (detalhe.statusCirurgia || 'agendada') === s.valor
                      return (
                        <Button key={s.valor} size="sm" className={['w-full px-1', atual && s.cls].filter(Boolean).join(' ')}
                          variant={atual ? s.ativo : 'ghost'}
                          aria-pressed={atual}
                          onClick={() => mudarStatus(s.valor)}>
                          {s.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {addCaso && (
        <AddCasoSheet escala={escala} onClose={() => setAddCaso(false)} />
      )}

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
